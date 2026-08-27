import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { consumeAiCredits } from "../_shared/consumeAiCredits.ts";
import {
  buildPixaiSearchAssistantLine,
  makePixaiPlaceholderSlots,
  runPixaiPlaceSearch,
  type PixaiSearchFlow,
} from "../_shared/pixaiPlaceSearch.ts";

type PixaiRpcName = "search_business_cards_in_city" | "search_business_cards_nearby" | "search_by_vibe";

function pixaiRpc(
  client: SupabaseClient,
  name: PixaiRpcName,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: { message: string } | null }> {
  return (client as unknown as {
    rpc(n: PixaiRpcName, a: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc(name, args);
}

type Flow = PixaiSearchFlow;

type VibeTimeline = "day" | "evening" | "night";

type VibeInput = {
  mood: string;
  timeline: VibeTimeline;
  city?: string;
  /** max stops in the route (clamped 1–8) */
  limit?: number;
};

type RpcVibeRow = {
  venue_id: string;
  name: string;
  vibe_score: number;
  booking_price: number;
  description: string | null;
  is_restaurant_table: boolean;
};

function normalizeVibeTimeline(v: string): VibeTimeline | null {
  if (v === "late_night") return "night";
  if (v === "day" || v === "evening" || v === "night") return v;
  return null;
}

const VIBE_WINDOW_SLOT_STEP_MINUTES = 120;
const VIBE_STOP_SPACING_MS = VIBE_WINDOW_SLOT_STEP_MINUTES * 60_000;
const VIBE_SLOT_GRID_MS = VIBE_WINDOW_SLOT_STEP_MINUTES * 60_000;

type TimelineWindowDef = { startMinutes: number; endMinutes: number };
type ResolvedTimelineWindowDef = TimelineWindowDef & { wrapsMidnight: boolean };

const VIBE_TIMELINE_WINDOWS: Record<VibeTimeline, TimelineWindowDef> = {
  day: { startMinutes: 6 * 60, endMinutes: 16 * 60 + 31 },
  evening: { startMinutes: 17 * 60, endMinutes: 21 * 60 + 31 },
  night: { startMinutes: 22 * 60, endMinutes: 2 * 60 + 1 },
};

function resolveTimelineDef(timeline: VibeTimeline): ResolvedTimelineWindowDef {
  return {
    ...VIBE_TIMELINE_WINDOWS[timeline],
    wrapsMidnight: timeline === "night",
  };
}

function localDayBounds(year: number, month: number, day: number, def: ResolvedTimelineWindowDef) {
  const dayStart = new Date(year, month, day, 0, 0, 0, 0);
  const startMs = dayStart.getTime() + def.startMinutes * 60_000;
  let endMs: number;
  if (def.wrapsMidnight && def.startMinutes > def.endMinutes) {
    endMs = new Date(year, month, day + 1, 0, 0, 0, 0).getTime() + def.endMinutes * 60_000;
  } else if (def.endMinutes >= 24 * 60) {
    endMs = new Date(year, month, day + 1, 0, 0, 0, 0).getTime();
  } else {
    endMs = dayStart.getTime() + def.endMinutes * 60_000;
  }
  return { startMs, endMs };
}

const VIBE_BOOKING_WINDOW_MIN_MS = 30 * 60_000;

function nextTimelineWindows(timeline: VibeTimeline, nowMs: number, maxDays = 4) {
  const def = resolveTimelineDef(timeline);
  const anchor = new Date(nowMs);
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  const windows: { startMs: number; endMs: number }[] = [];

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset += 1) {
    const { startMs, endMs } = localDayBounds(y, m, d + dayOffset, def);
    if (endMs > nowMs) {
      windows.push({ startMs, endMs });
    }
  }

  if (windows.length === 0) {
    windows.push(localDayBounds(y, m, d + 1, def));
  }

  return windows;
}

function getVibeTimelineWindow(timeline: VibeTimeline, nowMs = Date.now()) {
  return nextTimelineWindows(timeline, nowMs)[0];
}

function getEffectiveVibeSlotBounds(timeline: VibeTimeline, nowMs = Date.now()) {
  const minStartMs = nowMs + VIBE_BOOKING_WINDOW_MIN_MS;

  for (const { startMs, endMs } of nextTimelineWindows(timeline, nowMs)) {
    const effectiveStartMs = Math.max(startMs, minStartMs);
    if (effectiveStartMs <= endMs) {
      return { startMs: effectiveStartMs, endMs };
    }
  }

  const fallback = getVibeTimelineWindow(timeline, nowMs);
  return {
    startMs: Math.min(fallback.endMs, Math.max(fallback.startMs, minStartMs)),
    endMs: fallback.endMs,
  };
}


function snapIsoToThirtyMinuteGrid(iso: string, timeline: VibeTimeline, nowMs = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const { startMs, endMs } = getEffectiveVibeSlotBounds(timeline, nowMs);
  const clamped = Math.min(endMs, Math.max(startMs, t));
  const ceiled = Math.ceil(clamped / VIBE_SLOT_GRID_MS) * VIBE_SLOT_GRID_MS;
  return new Date(Math.min(endMs, Math.max(startMs, ceiled))).toISOString();
}

type VibePlanDraft = {
  venue_id: string;
  name: string;
  time_slot: string;
  vibe_score: number;
  description: string;
  booking_price: number;
  is_restaurant_table: boolean;
};

function buildVibePlanFromRows(rows: RpcVibeRow[], timeline: VibeTimeline, stopLimit: number, nowMs = Date.now()): VibePlanDraft[] {
  const { startMs } = getEffectiveVibeSlotBounds(timeline, nowMs);
  const plan: VibePlanDraft[] = [];
  let stopIndex = 0;

  for (const r of rows) {
    if (plan.length >= stopLimit) break;
    const rawSlot = new Date(startMs + stopIndex * VIBE_STOP_SPACING_MS);
    const timeSlot = snapIsoToThirtyMinuteGrid(rawSlot.toISOString(), timeline, nowMs);

    plan.push({
      venue_id: String(r.venue_id),
      name: String(r.name ?? ""),
      time_slot: timeSlot,
      vibe_score: Number(r.vibe_score ?? 0),
      description: (r.description ?? "").slice(0, 280),
      booking_price: Number(r.booking_price ?? 0),
      is_restaurant_table: Boolean(r.is_restaurant_table),
    });
    stopIndex += 1;
  }

  return plan;
}

async function resolveVibeCity(supabase: SupabaseClient, vibe: VibeInput): Promise<string | null> {
  const fromClient = (vibe.city ?? "").trim();
  if (fromClient) return fromClient;
  const { data, error } = await supabase.from("profiles").select("city").maybeSingle();
  if (error) {
    console.error("[pixai-orchestrate] vibe profile city:", error.message ?? error);
    return null;
  }
  const c = (data as { city?: string | null } | null)?.city;
  return c?.trim() || null;
}

async function handleVibe(supabase: SupabaseClient, vibe: VibeInput): Promise<Response> {
  const mood = (vibe.mood ?? "").trim();
  const timeline = normalizeVibeTimeline(vibe.timeline);
  if (!mood || !timeline) {
    return new Response(JSON.stringify({ error: "Missing vibe.mood or invalid vibe.timeline" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const city = await resolveVibeCity(supabase, vibe);
  if (!city) {
    return new Response(
      JSON.stringify({ error: "Missing city: set profile city or pass vibe.city" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const stopLimit = Math.max(1, Math.min(vibe.limit ?? 5, 8));
  const candidateLimit = Math.min(20, Math.max(stopLimit * 3, stopLimit));
  const { data, error } = await pixaiRpc(supabase, "search_by_vibe", {
    p_mood: mood,
    p_timeline: timeline,
    p_city: city,
    p_limit: candidateLimit,
  });

  if (error) {
    console.error("[pixai-orchestrate] search_by_vibe:", error.message ?? error);
    return new Response(
      JSON.stringify({
        assistant: "Could not build a vibe route right now. Try again or adjust your mood and city.",
        plan: [],
        places: [],
        slots: [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const rows = (Array.isArray(data) ? data : []) as RpcVibeRow[];
  const plan = buildVibePlanFromRows(rows, timeline, stopLimit);

  const ids = plan.map((p) => p.venue_id);
  let cardById = new Map<string, Record<string, unknown>>();
  if (ids.length > 0) {
    const { data: cards, error: cardErr } = await supabase
      .from("business_cards")
      .select("id,name,address,city,rating,booking_price,images,latitude,longitude")
      .in("id", ids);
    if (!cardErr && Array.isArray(cards)) {
      cardById = new Map(cards.map((c) => [String((c as Record<string, unknown>).id), c as Record<string, unknown>]));
    }
  }

  const planEnriched = plan.map((p) => {
    const c = cardById.get(p.venue_id);
    return {
      ...p,
      address: c?.address != null ? String(c.address) : "",
      city: c?.city != null ? String(c.city) : city,
      rating: c?.rating != null ? Number(c.rating) : 0,
      images: Array.isArray(c?.images) ? c!.images : [],
      latitude: c?.latitude != null ? Number(c.latitude) : null,
      longitude: c?.longitude != null ? Number(c.longitude) : null,
    };
  });

  const assistant =
    planEnriched.length === 0
      ? `No venues matched that vibe in ${city} with suggested times in the next 8 hours. Try a different mood or timeline.`
      : `Here is a ${timeline} route in ${city} for “${mood}” — ${planEnriched.length} stops with suggested times in the next 8 hours. Check live availability, then book in one tap.`;

  return new Response(
    JSON.stringify({
      assistant,
      plan: planEnriched,
      places: [],
      slots: [],
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = (await req.json()) as { flow?: Flow; vibe?: VibeInput; request_id?: string };
    const requestId =
      typeof body.request_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id)
        ? body.request_id
        : crypto.randomUUID();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.vibe && typeof body.vibe.mood === "string" && body.vibe.timeline) {
      return await handleVibe(supabase, body.vibe);
    }

    const flow = body.flow;
    if (!flow || !flow.mode) {
      return new Response(JSON.stringify({ error: "Missing required flow fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const searchResult = await runPixaiPlaceSearch(supabase, flow);
    const { places, meta, resolvedCity, effectiveFlow, expandedFromNearby } = searchResult;

    const slots = makePixaiPlaceholderSlots();
    let credits: { balance: number | null; charged: number } | undefined;

    if ((flow.comment ?? "").trim()) {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } },
      );
      const { data: creditData, error: creditError } = await consumeAiCredits(adminClient, {
        userId: userData.user.id,
        delta: 0.25,
        requestId,
      });
      if (creditError?.message.includes("insufficient_ai_credits")) {
        return new Response(JSON.stringify({ error: "insufficient_credits" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (creditError) {
        console.error("[pixai-orchestrate] credit deduction failed:", creditError.message);
        return new Response(JSON.stringify({ error: "credit_deduction_failed" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const creditResult =
        creditData && typeof creditData === "object"
          ? (creditData as Record<string, unknown>)
          : {};
      credits = {
        balance: typeof creditResult.balance === "number" ? creditResult.balance : null,
        charged: typeof creditResult.charged === "number" ? creditResult.charged : 0.25,
      };
    }

    return new Response(
      JSON.stringify({
        assistant: buildPixaiSearchAssistantLine(
          effectiveFlow,
          (places ?? []).length,
          expandedFromNearby,
          meta.is_fallback,
        ),
        places,
        slots,
        meta,
        resolved_city: resolvedCity,
        credits,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
