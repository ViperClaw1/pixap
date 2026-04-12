import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type PixaiRpcName = "search_business_cards_in_city" | "search_business_cards_nearby";

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

type Req = {
  flow: Flow;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = (await req.json()) as Req;
    const flow = body.flow;
    const city = normalizeCity(flow);
    if (!city || !flow?.mode) {
      return new Response(JSON.stringify({ error: "Missing required flow fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );

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
        expandedFromNearby =
          triedNearby && places.length > 0;
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
