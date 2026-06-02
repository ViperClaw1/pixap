import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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

type Flow = {
  city: string;
  categoryId?: string;
  categoryName?: string;
  isRestaurantTable?: boolean;
  comment?: string;
  mode: "nearby" | "city";
  radiusMiles?: number;
  location?: { lat: number; lng: number };
  limit?: number;
};

type VibeTimeline = "day" | "evening" | "night" | "late_night";

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

function normalizeCity(flow: Flow): string {
  return (flow.city ?? "").trim();
}

function normalizeCategoryId(flow: Flow): string | null {
  const raw = flow.categoryId?.trim();
  if (!raw || flow.isRestaurantTable) return null;
  return raw;
}

function normalizeCategoryName(flow: Flow): string | null {
  const raw = (flow.categoryName ?? "").trim();
  if (!raw || flow.isRestaurantTable) return null;
  return raw;
}

async function fetchPlacesInCityLegacy(
  supabase: SupabaseClient,
  flow: Flow,
  city: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  let query = supabase
    .from("business_cards")
    .select("id,name,address,city,rating,booking_price,image,tags,category_id")
    .ilike("city", city)
    .order("rating", { ascending: false })
    .limit(limit);
  const categoryId = normalizeCategoryId(flow);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (flow.isRestaurantTable) {
    query = query.or("name.ilike.%restaurant%,tags.cs.{restaurant},tags.cs.{table}");
  }
  const { data, error } = await query;
  if (error) {
    console.error("[pixai-orchestrate] legacy city query failed:", error.message ?? error);
    return [];
  }
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function fetchPlacesInCityRpc(
  supabase: SupabaseClient,
  flow: Flow,
  city: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await pixaiRpc(supabase, "search_business_cards_in_city", {
    p_city: city,
    p_category_id: normalizeCategoryId(flow),
    p_is_restaurant_table: flow.isRestaurantTable ?? false,
    p_limit: limit,
    p_category_name: normalizeCategoryName(flow),
  });
  if (!error) return (data ?? []) as Array<Record<string, unknown>>;
  return fetchPlacesInCityLegacy(supabase, flow, city, limit);
}

function buildAssistant(flow: Flow, placeCount: number, expandedFromNearby: boolean) {
  if (placeCount === 0) {
    return "I could not find matching places. Try changing city, category, or search scope.";
  }
  const cityLabel = normalizeCity(flow) || "your city";
  const requestType = flow.isRestaurantTable ? "restaurant tables" : "services";
  if (expandedFromNearby) {
    return `Nothing matched within 5 miles — nearby search only includes businesses with map coordinates. Here are ${placeCount} ${requestType} in ${cityLabel}. Pick one and I will suggest the best available slots.`;
  }
  const scopeText = flow.mode === "nearby" ? "near you" : `in ${cityLabel}`;
  return `I found ${placeCount} ${requestType} ${scopeText}. Pick one and I will suggest the best available slots.`;
}

function isVibeTimeline(v: string): v is VibeTimeline {
  return v === "day" || v === "evening" || v === "night" || v === "late_night";
}

const VIBE_STOP_SPACING_MS = 90 * 60_000;
const VIBE_SLOT_GRID_MS = 30 * 60_000;

type TimelineWindowDef = { startMinutes: number; endMinutes: number };

const VIBE_TIMELINE_WINDOWS: Record<VibeTimeline, TimelineWindowDef> = {
  day: { startMinutes: 8 * 60, endMinutes: 18 * 60 },
  evening: { startMinutes: 18 * 60, endMinutes: 21 * 60 },
  night: { startMinutes: 21 * 60, endMinutes: 24 * 60 },
  late_night: { startMinutes: 0, endMinutes: 3 * 60 },
};

function localDayBounds(year: number, month: number, day: number, def: TimelineWindowDef) {
  const dayStart = new Date(year, month, day, 0, 0, 0, 0);
  const startMs = dayStart.getTime() + def.startMinutes * 60_000;
  const endMs =
    def.endMinutes >= 24 * 60
      ? new Date(year, month, day + 1, 0, 0, 0, 0).getTime()
      : dayStart.getTime() + def.endMinutes * 60_000;
  return { startMs, endMs };
}

const VIBE_BOOKING_WINDOW_MIN_MS = 30 * 60_000;

function nextTimelineWindows(timeline: VibeTimeline, nowMs: number, maxDays = 4) {
  const def = VIBE_TIMELINE_WINDOWS[timeline];
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
  if (!mood || !isVibeTimeline(vibe.timeline)) {
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
    p_timeline: vibe.timeline,
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
  const plan = buildVibePlanFromRows(rows, vibe.timeline, stopLimit);

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
      : `Here is a ${vibe.timeline.replace("_", " ")} route in ${city} for “${mood}” — ${planEnriched.length} stops with suggested times in the next 8 hours. Check live availability, then book in one tap.`;

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

    const body = (await req.json()) as { flow?: Flow; vibe?: VibeInput };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );

    if (body.vibe && typeof body.vibe.mood === "string" && body.vibe.timeline) {
      return await handleVibe(supabase, body.vibe);
    }

    const flow = body.flow;
    const city = flow ? normalizeCity(flow) : "";
    if (!flow || !city || !flow.mode) {
      return new Response(JSON.stringify({ error: "Missing required flow fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = Math.max(3, Math.min(flow.limit ?? 8, 20));
    let places: Array<Record<string, unknown>> = [];
    let expandedFromNearby = false;

    try {
      const triedNearby = flow.mode === "nearby" && flow.location?.lat != null && flow.location?.lng != null;

      if (triedNearby) {
        const nearbyBase = {
          p_latitude: flow.location!.lat,
          p_longitude: flow.location!.lng,
          p_radius_miles: flow.radiusMiles ?? 5,
          p_city: city,
          p_category_id: normalizeCategoryId(flow),
          p_is_restaurant_table: flow.isRestaurantTable ?? false,
          p_limit: limit,
        };
        let { data, error } = await pixaiRpc(supabase, "search_business_cards_nearby", {
          ...nearbyBase,
          p_category_name: normalizeCategoryName(flow),
        });
        if (error) {
          ({ data, error } = await pixaiRpc(supabase, "search_business_cards_nearby", nearbyBase));
        }
        if (!error) places = (data ?? []) as Array<Record<string, unknown>>;
      }

      if (places.length === 0) {
        places = await fetchPlacesInCityRpc(supabase, flow, city, limit);
        expandedFromNearby = triedNearby && places.length > 0;
      }
    } catch (e) {
      console.error("[pixai-orchestrate] place search failed:", (e as Error)?.message ?? e);
      places = [];
      expandedFromNearby = false;
    }

    const slots = [
      { label: "10:00", dateTimeIso: new Date(Date.now() + 60 * 60 * 1000).toISOString(), available: true, isBest: false },
      { label: "11:00", dateTimeIso: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), available: true, isBest: false },
      { label: "12:00", dateTimeIso: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), available: false, isBest: false },
      { label: "13:00", dateTimeIso: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), available: true, isBest: false },
    ];

    return new Response(
      JSON.stringify({
        assistant: buildAssistant(flow, (places ?? []).length, expandedFromNearby),
        places,
        slots,
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
