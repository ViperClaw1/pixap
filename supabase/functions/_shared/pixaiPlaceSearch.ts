import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractCityFromQuery, normalizeCityList } from "./extractCityFromQuery.ts";
import { resolvePixaiSearchPlaceLimits } from "./pixaiSearchPlaceLimits.ts";
import { expandQuery } from "./queryExpansion.ts";

export type PixaiSearchFlow = {
  city: string;
  categoryId?: string;
  categoryName?: string;
  isRestaurantTable?: boolean;
  comment?: string;
  mode: "nearby" | "city";
  radiusMiles?: number;
  location?: { lat: number; lng: number };
};

export type PixaiSearchMeta = {
  is_fallback: boolean;
  fts_matched: boolean;
  original_query: string | null;
};

export type PixaiPlaceSearchResult = {
  places: Array<Record<string, unknown>>;
  meta: PixaiSearchMeta;
  resolvedCity: string;
  effectiveFlow: PixaiSearchFlow;
  expandedFromNearby: boolean;
};

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

const BUSINESS_CARD_SELECT =
  "id,name,address,city,rating,booking_price,image,images,blurhashes,tags,category_id,cuisine_types,menu_items,price_tier";

type PixaiSearchLimits = { direct: number; fallback: number };

function normalizeCity(flow: PixaiSearchFlow): string {
  return (flow.city ?? "").trim();
}

export async function fetchDistinctCatalogCities(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_business_card_cities");
  if (error) {
    console.warn("[pixai-place-search] catalog cities lookup failed:", error.message ?? error);
    return [];
  }
  return normalizeCityList(
    (data ?? []).map((row) => String((row as { city?: string | null }).city ?? "")),
  );
}

export function resolveSearchCity(flow: PixaiSearchFlow, knownCities: string[]): string {
  const comment = (flow.comment ?? "").trim();
  if (comment && knownCities.length > 0) {
    const fromQuery = extractCityFromQuery(comment, knownCities);
    if (fromQuery) return fromQuery;
  }
  return normalizeCity(flow);
}

function normalizeCategoryId(flow: PixaiSearchFlow): string | null {
  const raw = flow.categoryId?.trim();
  if (!raw || flow.isRestaurantTable) return null;
  return raw;
}

function normalizeCategoryName(flow: PixaiSearchFlow): string | null {
  const raw = (flow.categoryName ?? "").trim();
  if (!raw || flow.isRestaurantTable) return null;
  return raw;
}

function expandedSearchQuery(flow: PixaiSearchFlow): string {
  return expandQuery((flow.comment ?? "").trim());
}

function placesHaveFtsMatch(places: Array<Record<string, unknown>>): boolean {
  return places.some((place) => place.fts_matched === true);
}

export function buildPixaiSearchMeta(
  flow: PixaiSearchFlow,
  places: Array<Record<string, unknown>>,
): PixaiSearchMeta {
  const originalQuery = (flow.comment ?? "").trim() || null;
  const hasFtsMatch = placesHaveFtsMatch(places);
  const isFallback = Boolean(originalQuery) && places.length > 0 && !hasFtsMatch;
  return {
    is_fallback: isFallback,
    fts_matched: hasFtsMatch,
    original_query: originalQuery,
  };
}

async function fetchPlacesInCityLegacy(
  supabase: SupabaseClient,
  flow: PixaiSearchFlow,
  city: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  let query = supabase
    .from("business_cards")
    .select(BUSINESS_CARD_SELECT)
    .order("rating", { ascending: false })
    .limit(limit);
  if (city) query = query.ilike("city", city);
  const categoryId = normalizeCategoryId(flow);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (flow.isRestaurantTable) {
    query = query.or("name.ilike.%restaurant%,tags.cs.{restaurant},tags.cs.{table}");
  }
  const { data, error } = await query;
  if (error) {
    console.error("[pixai-place-search] legacy city query failed:", error.message ?? error);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    fts_matched: row.fts_matched === true,
  }));
}

async function fetchPlacesInCityRpc(
  supabase: SupabaseClient,
  flow: PixaiSearchFlow,
  city: string,
  limits: PixaiSearchLimits,
): Promise<Array<Record<string, unknown>>> {
  if (!city) return fetchPlacesInCityLegacy(supabase, flow, city, limits.fallback);

  const comment = expandedSearchQuery(flow);
  const { data, error } = await pixaiRpc(supabase, "search_business_cards_in_city", {
    p_city: city,
    p_category_id: normalizeCategoryId(flow),
    p_is_restaurant_table: flow.isRestaurantTable ?? false,
    p_limit: limits.direct,
    p_fallback_limit: limits.fallback,
    p_category_name: normalizeCategoryName(flow),
    p_query: comment || null,
  });
  if (!error) return (data ?? []) as Array<Record<string, unknown>>;
  return fetchPlacesInCityLegacy(supabase, flow, city, limits.fallback);
}

export function buildPixaiSearchAssistantLine(
  flow: PixaiSearchFlow,
  placeCount: number,
  expandedFromNearby: boolean,
  isFallback = false,
): string {
  if (placeCount === 0) {
    return "I could not find matching places. Try changing city, category, or search scope.";
  }
  const cityLabel = normalizeCity(flow) || "all cities";
  const query = (flow.comment ?? "").trim();
  if (isFallback && query) {
    return (
      `Exact matches for "${query}" aren't available yet — menu data is still being added. ` +
      `Here are the top-rated venues in ${cityLabel} — the AI assistant can help narrow these down.`
    );
  }
  const requestType = flow.isRestaurantTable ? "restaurant tables" : "services";
  if (expandedFromNearby) {
    return `Nothing matched within 5 miles — nearby search only includes businesses with map coordinates. Here are ${placeCount} ${requestType} in ${cityLabel}. Pick one and I will suggest the best available slots.`;
  }
  const scopeText = flow.mode === "nearby" ? "near you" : `in ${cityLabel}`;
  return `I found ${placeCount} ${requestType} ${scopeText}. Pick one and I will suggest the best available slots.`;
}

export async function runPixaiPlaceSearch(
  supabase: SupabaseClient,
  flow: PixaiSearchFlow,
  knownCities?: string[],
): Promise<PixaiPlaceSearchResult> {
  const cities = knownCities ?? (await fetchDistinctCatalogCities(supabase));
  const resolvedCity = resolveSearchCity(flow, cities);
  const effectiveFlow = resolvedCity !== normalizeCity(flow) ? { ...flow, city: resolvedCity } : flow;
  const searchLimits = resolvePixaiSearchPlaceLimits();

  let places: Array<Record<string, unknown>> = [];
  let expandedFromNearby = false;

  const triedNearby = flow.mode === "nearby" && flow.location?.lat != null && flow.location?.lng != null;

  if (triedNearby) {
    const nearbyComment = expandedSearchQuery(flow);
    const nearbyBase = {
      p_latitude: flow.location!.lat,
      p_longitude: flow.location!.lng,
      p_radius_miles: flow.radiusMiles ?? 5,
      p_city: resolvedCity,
      p_category_id: normalizeCategoryId(flow),
      p_is_restaurant_table: flow.isRestaurantTable ?? false,
      p_limit: searchLimits.direct,
      p_fallback_limit: searchLimits.fallback,
      p_query: nearbyComment || null,
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
    places = await fetchPlacesInCityRpc(supabase, effectiveFlow, resolvedCity, searchLimits);
    expandedFromNearby = triedNearby && places.length > 0;
  }

  const meta = buildPixaiSearchMeta(effectiveFlow, places);
  return { places, meta, resolvedCity, effectiveFlow, expandedFromNearby };
}

export function makePixaiPlaceholderSlots() {
  return [
    { label: "10:00", dateTimeIso: new Date(Date.now() + 60 * 60 * 1000).toISOString(), available: true, isBest: false },
    { label: "11:00", dateTimeIso: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), available: true, isBest: false },
    { label: "12:00", dateTimeIso: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), available: false, isBest: false },
    { label: "13:00", dateTimeIso: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), available: true, isBest: false },
  ];
}
