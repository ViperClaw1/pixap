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

type VibeTimeline = "evening" | "night" | "late_night";

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
  return v === "evening" || v === "night" || v === "late_night";
}

/** UTC anchor hour for vibe route spacing; if that moment already passed today, use tomorrow. */
function timelineAnchorUtc(timeline: VibeTimeline): Date {
  const hourStart = timeline === "evening" ? 17 : timeline === "night" ? 21 : 23;
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(hourStart, 0, 0, 0);
  if (d.getTime() <= Date.now()) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60_000);
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
  const { data, error } = await pixaiRpc(supabase, "search_by_vibe", {
    p_mood: mood,
    p_timeline: vibe.timeline,
    p_city: city,
    p_limit: stopLimit,
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
  const anchor = timelineAnchorUtc(vibe.timeline);

  const plan = rows.map((r, i) => ({
    venue_id: String(r.venue_id),
    name: String(r.name ?? ""),
    time_slot: addMinutes(anchor, i * 90).toISOString(),
    vibe_score: Number(r.vibe_score ?? 0),
    description: (r.description ?? "").slice(0, 280),
    booking_price: Number(r.booking_price ?? 0),
    is_restaurant_table: Boolean(r.is_restaurant_table),
  }));

  const ids = plan.map((p) => p.venue_id);
  let cardById = new Map<string, Record<string, unknown>>();
  if (ids.length > 0) {
    const { data: cards, error: cardErr } = await supabase
      .from("business_cards")
      .select("id,name,address,city,rating,booking_price,images")
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
    };
  });

  const assistant =
    planEnriched.length === 0
      ? `No venues matched that vibe in ${city} yet. Try a different mood or broaden your search.`
      : `Here is a ${vibe.timeline.replace("_", " ")} route in ${city} for “${mood}” — ${planEnriched.length} stops with suggested times. Check live availability, then book in one tap.`;

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
