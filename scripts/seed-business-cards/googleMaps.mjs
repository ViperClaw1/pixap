import { normalizeListingAddress } from "./dedupe.mjs";
import { assessUpscaleRestaurant } from "./googleRestaurantFilter.mjs";
import { log, normalizeSeedPhone, sleep, toNodeBuffer, withRetry } from "./lib.mjs";

const BASE = "https://maps.googleapis.com/maps/api";
const API_DELAY_MS = 350;
const REQUEST_TIMEOUT_MS = 45_000;
const NEARBY_RADIUS_M = 280;
const TEXT_SEARCH_RADIUS_M = 450;

/** Maps venue `photoPool` → Places text-search query fragment. */
export const VENUE_PLACE_QUERIES = {
  restaurant: "fine dining restaurant",
  cafe: "cafe",
  bar: "bar",
  hotel: "hotel",
  gym: "gym",
  beauty: "beauty salon",
  coworking: "coworking space",
  club: "night club",
  hookah: "hookah lounge",
};

/** Legacy Nearby Search `type` (see Google Place Types). */
const NEARBY_PLACE_TYPE = {
  restaurant: "restaurant",
  cafe: "cafe",
  bar: "bar",
  hotel: "lodging",
  gym: "gym",
  beauty: "beauty_salon",
  club: "night_club",
  coworking: null,
  hookah: null,
};

/** Used when Nearby `type` is not available, or to bias restaurant results. */
const NEARBY_KEYWORD = {
  restaurant: "fine dining",
  coworking: "coworking",
  hookah: "hookah lounge",
};

async function mapsGet(path, params, label) {
  const q = new URLSearchParams({ ...params });
  const url = `${BASE}/${path}?${q.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const data = await withRetry(label, async () => {
      const res = await fetch(url, { signal: controller.signal });
      const json = await res.json();
      if (json.status === "OVER_QUERY_LIMIT" || json.status === "RESOURCE_EXHAUSTED") {
        const err = new Error(`${label}: ${json.status}${json.error_message ? ` — ${json.error_message}` : ""}`);
        err.status = 429;
        throw err;
      }
      if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
        throw new Error(`${label}: ${json.status}${json.error_message ? ` — ${json.error_message}` : ""}`);
      }
      return json;
    });
    await sleep(API_DELAY_MS);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @returns {{ label: string, lat: number, lng: number }}
 */
export async function geocodeCity(cityName, apiKey) {
  const data = await mapsGet(
    "geocode/json",
    { address: cityName, key: apiKey },
    `geocode:${cityName}`,
  );
  const hit = data.results?.[0];
  if (!hit?.geometry?.location) {
    throw new Error(`geocode: no results for "${cityName}"`);
  }
  const { lat, lng } = hit.geometry.location;
  const components = hit.address_components ?? [];
  const locality =
    components.find((c) => c.types?.includes("locality"))?.long_name ??
    components.find((c) => c.types?.includes("postal_town"))?.long_name ??
    cityName.trim();
  const country = components.find((c) => c.types?.includes("country"))?.long_name;
  const label = country ? `${locality}, ${country}` : (hit.formatted_address ?? cityName.trim());
  return { label, lat, lng };
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function placeLatLng(place) {
  const loc = place?.geometry?.location;
  if (loc == null || loc.lat == null || loc.lng == null) return null;
  return { lat: loc.lat, lng: loc.lng };
}

function photoReferencesFromPlace(place) {
  const refs = (place.photos ?? [])
    .map((p) => p.photo_reference)
    .filter((r) => typeof r === "string" && r.length > 0);
  return [...new Set(refs)];
}

function rankPlacesByDistance(results, target) {
  return results
    .map((place) => {
      const loc = placeLatLng(place);
      if (!loc || !place.place_id) return null;
      return {
        place,
        distanceM: haversineMeters(target, loc),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceM - b.distanceM);
}

function dedupePlacesById(places) {
  const seen = new Set();
  const out = [];
  for (const place of places) {
    if (!place?.place_id || seen.has(place.place_id)) continue;
    seen.add(place.place_id);
    out.push(place);
  }
  return out;
}

async function nearbySearchNearVenue(venue, apiKey) {
  const poolType = NEARBY_PLACE_TYPE[venue.photoPool];
  const keyword = NEARBY_KEYWORD[venue.photoPool];
  const params = {
    location: `${venue.latitude},${venue.longitude}`,
    radius: String(NEARBY_RADIUS_M),
    key: apiKey,
  };
  if (poolType) params.type = poolType;
  if (keyword) params.keyword = keyword;

  const data = await mapsGet("place/nearbysearch/json", params, `nearby:${venue.slug}`);
  return data.results ?? [];
}

async function textSearchNearVenue(venue, apiKey) {
  const query = VENUE_PLACE_QUERIES[venue.photoPool] ?? "restaurant";
  const data = await mapsGet(
    "place/textsearch/json",
    {
      query,
      location: `${venue.latitude},${venue.longitude}`,
      radius: String(TEXT_SEARCH_RADIUS_M),
      key: apiKey,
    },
    `textsearch-near:${venue.slug}`,
  );
  return data.results ?? [];
}

function normalizePlaceNameLabel(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "'");
}

function scorePlaceNameMatch(resultName, queryName) {
  const a = normalizePlaceNameLabel(resultName);
  const b = normalizePlaceNameLabel(queryName);
  if (!a || !b) return 99;
  if (a === b) return 0;
  if (a.startsWith(b) || b.startsWith(a)) return 1;
  if (a.includes(b) || b.includes(a)) return 2;
  return 3;
}

function rankPlacesByName(results, queryName) {
  return [...results]
    .filter((place) => place?.place_id && place.name?.trim())
    .sort((left, right) => {
      const scoreDiff =
        scorePlaceNameMatch(left.name, queryName) - scorePlaceNameMatch(right.name, queryName);
      if (scoreDiff !== 0) return scoreDiff;
      const ratingDiff = (right.rating ?? 0) - (left.rating ?? 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (right.user_ratings_total ?? 0) - (left.user_ratings_total ?? 0);
    });
}

async function textSearchPlaceId(query, apiKey, label) {
  const trimmed = query?.trim();
  if (!trimmed) return null;
  const data = await mapsGet("place/textsearch/json", { query: trimmed, key: apiKey }, label);
  return data.results?.[0]?.place_id ?? null;
}

function mapsQueryFromExpandedUrl(expandedUrl) {
  try {
    return new URL(expandedUrl).searchParams.get("q")?.trim() ?? null;
  } catch {
    return null;
  }
}

function isPlacesApiPlaceId(placeId) {
  return typeof placeId === "string" && GOOGLE_PLACE_ID_RE.test(placeId.trim());
}

async function textSearchByPlaceName(placeName, cityLabel, apiKey) {
  const cityShort = cityLabel.split(",")[0]?.trim() ?? cityLabel.trim();
  const query = cityShort ? `${placeName} ${cityShort}` : placeName;
  const data = await mapsGet(
    "place/textsearch/json",
    { query, key: apiKey },
    `textsearch-name:${placeName}`,
  );
  return data.results ?? [];
}

const PLACE_DETAILS_FIELDS =
  "place_id,name,formatted_address,address_components,geometry,photos,business_status,types,price_level,formatted_phone_number,international_phone_number,rating,user_ratings_total";

const PLACES_NEW_BASE = "https://places.googleapis.com/v1";

/** Google Places New `primaryType` / `types[]` → searchable cuisine tags (EN + RU). */
export const GOOGLE_TYPE_TO_CUISINE = {
  pizza_restaurant: ["pizza", "пицца", "italian", "итальянская"],
  italian_restaurant: ["italian", "итальянская", "pasta", "паста"],
  japanese_restaurant: ["japanese", "японская", "sushi", "суши"],
  sushi_restaurant: ["sushi", "суши", "japanese", "японская"],
  ramen_restaurant: ["ramen", "рамен", "japanese", "японская"],
  hamburger_restaurant: ["burger", "бургер", "american", "американская"],
  american_restaurant: ["american", "американская", "burger", "бургер"],
  chinese_restaurant: ["chinese", "китайская", "wok", "вок"],
  thai_restaurant: ["thai", "тайская"],
  indian_restaurant: ["indian", "индийская", "curry", "карри"],
  mexican_restaurant: ["mexican", "мексиканская", "tacos", "такос"],
  french_restaurant: ["french", "французская"],
  georgian_restaurant: ["georgian", "грузинская", "хинкали", "хачапури"],
  korean_restaurant: ["korean", "корейская", "bbq"],
  seafood_restaurant: ["seafood", "морепродукты", "рыба", "fish"],
  steak_house: ["steak", "стейк", "grill", "гриль", "мясо"],
  barbecue_restaurant: ["bbq", "шашлык", "гриль", "мангал"],
  uzbek_restaurant: ["uzbek", "узбекская", "плов", "лагман"],
  vegetarian_restaurant: ["vegetarian", "вегетарианская", "vegan", "веган"],
  cafe: ["cafe", "кафе", "coffee", "кофе"],
  coffee_shop: ["coffee", "кофе", "specialty coffee"],
  bar: ["bar", "бар", "cocktail", "коктейль"],
  night_club: ["club", "клуб", "nightlife"],
  bakery: ["bakery", "выпечка", "хлеб", "bread"],
};

const PRICE_LEVEL_TO_TIER = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 3,
};

const LEGACY_PRICE_LEVEL_TO_TIER = {
  0: 1,
  1: 1,
  2: 2,
  3: 3,
  4: 3,
};

/** Static cuisine tag → typical menu items for FTS (quick start without Gemini). */
const CUISINE_TO_MENU_ITEMS = {
  italian: ["carbonara", "fettuccine alfredo", "lasagna", "risotto", "tiramisu", "bruschetta"],
  итальянская: ["карбонара", "лазанья", "ризотто", "тирамису", "брускетта"],
  pasta: ["carbonara", "fettuccine alfredo", "lasagna", "bolognese", "pesto pasta"],
  паста: ["карбонара", "лазанья", "болоньезе", "песто"],
  pizza: ["pizza margherita", "pizza pepperoni", "quattro formaggi", "calzone"],
  пицца: ["пицца маргарита", "пицца пепперони", "четыре сыра", "кальцоне"],
  japanese: ["sushi", "ramen", "udon", "tempura", "miso soup", "edamame"],
  японская: ["суши", "рамэн", "удон", "темпура", "мисо суп"],
  sushi: ["salmon nigiri", "tuna roll", "california roll", "maki", "sashimi"],
  суши: ["нигири", "ролл", "сашими", "маки"],
  ramen: ["tonkotsu ramen", "shoyu ramen", "miso ramen", "gyoza"],
  рамен: ["тонкоцу рамен", "сёю рамен", "мисо рамен", "гёдза"],
  burger: ["cheeseburger", "hamburger", "bacon burger", "fries"],
  бургер: ["чизбургер", "гамбургер", "бургер с беконом", "картофель фри"],
  american: ["burger", "ribs", "mac and cheese", "wings"],
  американская: ["бургер", "рёбрышки", "крылышки"],
  chinese: ["dim sum", "kung pao chicken", "fried rice", "dumplings"],
  китайская: ["дим-сам", "курица кунг-пao", "жареный рис", "пельмени"],
  thai: ["pad thai", "green curry", "tom yum", "spring rolls"],
  тайская: ["пад тай", "зелёное карри", "том ям", "спринг-роллы"],
  indian: ["butter chicken", "biryani", "naan", "tikka masala", "samosa"],
  индийская: ["бutter chicken", "бирьяни", "наан", "тикка масала"],
  mexican: ["tacos", "burrito", "guacamole", "quesadilla", "nachos"],
  мексиканская: ["такос", "буррито", "гуакамоле", "кесадилья"],
  georgian: ["khinkali", "khachapuri", "shashlik", "chakhokhbili", "kharcho"],
  грузинская: ["хинкали", "хачапури", "шашлык", "чахохбили", "харчо"],
  korean: ["bibimbap", "bulgogi", "kimchi", "korean bbq"],
  корейская: ["бибимбап", "bulgogi", "кимчи"],
  seafood: ["grilled fish", "shrimp", "oysters", "ceviche"],
  морепродукты: ["рыба на гриле", "креветки", "устрицы"],
  steak: ["ribeye", "filet mignon", "t-bone", "strip steak"],
  стейк: ["рибай", "филе миньон", "t-bone"],
  bbq: ["pulled pork", "brisket", "ribs", "coleslaw"],
  uzbek: ["plov", "lagman", "samsa", "shashlik"],
  узбекская: ["плов", "лагман", "самса", "шашлык"],
  vegetarian: ["veggie bowl", "salad", "falafel", "hummus"],
  вегетарианская: ["овощной боул", "салат", "фалафель"],
  coffee: ["espresso", "cappuccino", "latte", "flat white", "croissant"],
  кофе: ["эспрессо", "капучино", "латте", "круассан"],
};

const PLACES_NEW_DETAILS_FIELDS = [
  "id",
  "types",
  "primaryType",
  "primaryTypeDisplayName",
  "priceLevel",
  "editorialSummary",
  "websiteUri",
].join(",");

export const EXTERNAL_BOOKING_DOMAIN_PATTERNS = [
  { platform: "resy", patterns: ["resy.com"] },
  { platform: "opentable", patterns: ["opentable.com"] },
  { platform: "tock", patterns: ["exploretock.com", "tock.com"] },
];

export function extractCuisineTypes(placeData) {
  const cuisines = new Set();
  const primaryType = placeData?.primaryType;
  if (primaryType && GOOGLE_TYPE_TO_CUISINE[primaryType]) {
    GOOGLE_TYPE_TO_CUISINE[primaryType].forEach((tag) => cuisines.add(tag));
  }
  for (const type of placeData?.types ?? []) {
    if (GOOGLE_TYPE_TO_CUISINE[type]) {
      GOOGLE_TYPE_TO_CUISINE[type].forEach((tag) => cuisines.add(tag));
    }
  }
  return [...cuisines];
}

export function extractPriceTier(placeData, legacyPriceLevel = null) {
  const fromNew = PRICE_LEVEL_TO_TIER[placeData?.priceLevel];
  if (fromNew != null) return fromNew;
  if (typeof legacyPriceLevel === "number") {
    return LEGACY_PRICE_LEVEL_TO_TIER[legacyPriceLevel] ?? null;
  }
  return null;
}

export function extractExternalBookingInfo(placeData) {
  const website = placeData?.websiteUri;
  if (!website || typeof website !== "string") return { platform: null, url: null };
  const lower = website.toLowerCase();
  for (const { platform, patterns } of EXTERNAL_BOOKING_DOMAIN_PATTERNS) {
    if (patterns.some((p) => lower.includes(p))) {
      return { platform, url: website };
    }
  }
  return { platform: null, url: null };
}

export function deriveMenuItemsFromCuisineTypes(cuisineTypes) {
  const items = new Set();
  for (const tag of cuisineTypes ?? []) {
    const key = tag.trim().toLowerCase();
    const mapped = CUISINE_TO_MENU_ITEMS[key];
    if (mapped) mapped.forEach((item) => items.add(item));
  }
  return [...items].slice(0, 12);
}

export async function loadPlaceDetailsNew(placeId, apiKey) {
  const encodedId = encodeURIComponent(placeId.trim());
  const url = `${PLACES_NEW_BASE}/places/${encodedId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const data = await withRetry(`places-new:${placeId}`, async () => {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": PLACES_NEW_DETAILS_FIELDS,
        },
      });
      const json = await res.json();
      if (res.status === 429) {
        const err = new Error("Places New API: RESOURCE_EXHAUSTED");
        err.status = 429;
        throw err;
      }
      if (!res.ok) {
        throw new Error(
          `Places New API: HTTP ${res.status}${json.error?.message ? ` — ${json.error.message}` : ""}`,
        );
      }
      return json;
    });
    await sleep(API_DELAY_MS);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function enrichPlaceWithNewApiData(place, apiKey) {
  if (!place?.place_id || !apiKey) {
    return {
      newApiData: null,
      cuisine_types: [],
      price_tier: extractPriceTier(null, place?.price_level),
      menu_items: [],
      external_booking_platform: null,
      external_booking_url: null,
    };
  }

  try {
    const newApiData = await loadPlaceDetailsNew(place.place_id, apiKey);
    const cuisine_types = extractCuisineTypes(newApiData);
    const price_tier = extractPriceTier(newApiData, place.price_level);
    const menu_items = deriveMenuItemsFromCuisineTypes(cuisine_types);
    const { platform: external_booking_platform, url: external_booking_url } =
      extractExternalBookingInfo(newApiData);
    return { newApiData, cuisine_types, price_tier, menu_items, external_booking_platform, external_booking_url };
  } catch (err) {
    log(
      "google",
      `Places New API skipped for ${place.place_id}: ${err instanceof Error ? err.message : String(err)}`,
    );
    const cuisine_types = [];
    const price_tier = extractPriceTier(null, place.price_level);
    return {
      newApiData: null,
      cuisine_types,
      price_tier,
      menu_items: deriveMenuItemsFromCuisineTypes(cuisine_types),
      external_booking_platform: null,
      external_booking_url: null,
    };
  }
}

async function loadPlaceDetails(placeId, apiKey, label) {
  const details = await mapsGet(
    "place/details/json",
    {
      place_id: placeId,
      fields: PLACE_DETAILS_FIELDS,
      key: apiKey,
    },
    label,
  );
  return details.result ?? null;
}

export function cityLabelFromAddressComponents(components) {
  if (!Array.isArray(components) || !components.length) return null;
  const locality =
    components.find((c) => c.types?.includes("locality"))?.long_name ??
    components.find((c) => c.types?.includes("postal_town"))?.long_name ??
    components.find((c) => c.types?.includes("administrative_area_level_2"))?.long_name ??
    components.find((c) => c.types?.includes("administrative_area_level_1"))?.long_name;
  const country = components.find((c) => c.types?.includes("country"))?.long_name;
  if (locality && country) return `${locality}, ${country}`;
  return null;
}

function cityLabelFromPlace(place) {
  return (
    cityLabelFromAddressComponents(place.address_components) ??
    place.formatted_address?.split(",").slice(-2).join(",").trim() ??
    null
  );
}

const GOOGLE_PLACE_ID_RE = /^(ChIJ[\w-]+|Ei[\w-]+)$/i;
const HEX_PLACE_ID_RE = /^0x[0-9a-f]+:0x[0-9a-f]+$/i;

async function expandMapsShortUrl(mapsLink) {
  const trimmed = mapsLink.trim();
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Invalid Google Maps URL: ${trimmed.slice(0, 120)}`);
  }

  const host = url.hostname.toLowerCase();
  const isShort = host === "maps.app.goo.gl" || host === "goo.gl" || host.endsWith(".goo.gl");
  if (!isShort) return trimmed;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(trimmed, { signal: controller.signal, redirect: "follow" });
    await sleep(API_DELAY_MS);
    return res.url || trimmed;
  } finally {
    clearTimeout(timer);
  }
}

function extractPlaceIdFromMapsUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  const queryPlaceId = url.searchParams.get("place_id");
  if (queryPlaceId?.trim()) return queryPlaceId.trim();

  const q = url.searchParams.get("q");
  if (q) {
    const fromQ = q.match(/place_id:([^\s&]+)/i);
    if (fromQ?.[1]) return fromQ[1];
  }

  const decoded = decodeURIComponent(urlString);

  const oneSMatch = decoded.match(/!1s([^!/?&#]+)/);
  if (oneSMatch?.[1]) {
    const candidate = decodeURIComponent(oneSMatch[1]);
    if (GOOGLE_PLACE_ID_RE.test(candidate) || HEX_PLACE_ID_RE.test(candidate)) {
      return candidate;
    }
  }

  const pathPlaceId = decoded.match(/\/place\/(ChIJ[\w-]+)/i);
  if (pathPlaceId?.[1]) return pathPlaceId[1];

  return null;
}

function extractCoordsFromMapsUrl(urlString) {
  const match = urlString.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function extractPlaceNameFromMapsPath(urlString) {
  const match = urlString.match(/\/maps\/place\/([^/@?]+)/i);
  if (!match?.[1]) return null;
  const raw = decodeURIComponent(match[1].replace(/\+/g, " "));
  const cleaned = raw.split(",")[0]?.trim();
  return cleaned || null;
}

async function findPlaceIdFromTextInput(input, apiKey, label) {
  const data = await mapsGet(
    "place/findplacefromtext/json",
    {
      input,
      inputtype: "textquery",
      fields: "place_id",
      key: apiKey,
    },
    label,
  );
  return data.candidates?.[0]?.place_id ?? null;
}

async function resolvePlaceIdFromMapsUrl(expandedUrl, apiKey) {
  const direct = extractPlaceIdFromMapsUrl(expandedUrl);
  if (direct && isPlacesApiPlaceId(direct)) return direct;

  const fromUrl = await findPlaceIdFromTextInput(expandedUrl, apiKey, "findplace:maps-url");
  if (fromUrl) return fromUrl;

  const mapsQuery = mapsQueryFromExpandedUrl(expandedUrl);
  if (mapsQuery) {
    const fromMapsQuery = await textSearchPlaceId(mapsQuery, apiKey, "textsearch:maps-q");
    if (fromMapsQuery) return fromMapsQuery;

    const queryName = mapsQuery.split(",")[0]?.trim();
    if (queryName && queryName !== mapsQuery) {
      const cityHint = mapsQuery.split(",").slice(-2).join(",").trim();
      const biasedQuery = cityHint ? `${queryName}, ${cityHint}` : queryName;
      const fromNameBias = await textSearchPlaceId(biasedQuery, apiKey, `textsearch:${queryName}`);
      if (fromNameBias) return fromNameBias;
    }
  }

  const placeName = extractPlaceNameFromMapsPath(expandedUrl);
  if (placeName) {
    const fromName = await findPlaceIdFromTextInput(placeName, apiKey, `findplace:${placeName}`);
    if (fromName) return fromName;
  }

  const coords = extractCoordsFromMapsUrl(expandedUrl);
  if (coords) {
    const data = await mapsGet(
      "geocode/json",
      { latlng: `${coords.lat},${coords.lng}`, key: apiKey },
      `geocode-reverse:maps-link@${coords.lat},${coords.lng}`,
    );
    const poiTypes = new Set([
      "establishment",
      "point_of_interest",
      "food",
      "restaurant",
      "cafe",
      "bar",
      "lodging",
      "store",
    ]);
    for (const result of data.results ?? []) {
      if (result.place_id && result.types?.some((type) => poiTypes.has(type))) {
        return result.place_id;
      }
    }
    return data.results?.[0]?.place_id ?? null;
  }

  return null;
}

function passesVenuePlaceFilter(place, venue) {
  if (venue.photoPool !== "restaurant") return { ok: true };

  const assessment = assessUpscaleRestaurant(place);
  if (!assessment.ok) {
    log(
      "google",
      `Skip "${place.name ?? "?"}" — ${assessment.reason} (${venue.slug})`,
    );
    return { ok: false, reason: assessment.reason };
  }
  return { ok: true };
}

async function resolvePlaceCandidate(candidate, venue, apiKey, distanceM, { skipVenueFilter = false } = {}) {
  let place = candidate;

  if (place.place_id && (!place.formatted_address || !place.geometry?.location)) {
    const detailed = await loadPlaceDetails(place.place_id, apiKey, `details:${venue.slug}`);
    if (detailed) place = { ...place, ...detailed };
  }

  const filter = skipVenueFilter ? { ok: true } : passesVenuePlaceFilter(place, venue);
  if (!filter.ok) return null;

  const photoReferences = photoReferencesFromPlace(place);
  if (!photoReferences.length) return null;

  const loc = placeLatLng(place);
  if (!loc) return null;

  const name = place.name?.trim();
  const formatted_address = place.formatted_address?.trim();
  if (!name || !formatted_address) return null;

  const phone = normalizeSeedPhone(
    place.international_phone_number ?? place.formatted_phone_number ?? null,
  );

  const enrichment = await enrichPlaceWithNewApiData(place, apiKey);

  return {
    placeId: place.place_id,
    name,
    formatted_address,
    cityLabel: cityLabelFromPlace(place),
    lat: loc.lat,
    lng: loc.lng,
    photoReferences,
    phone,
    distanceM: Math.round(distanceM),
    source: "nearby",
    types: place.types,
    price_level: place.price_level,
    ...enrichment,
  };
}

/**
 * Finds the closest Google POI to `venue.latitude` / `venue.longitude` (not a random venue in the city).
 * @returns {Promise<{ placeId: string, name: string, formatted_address: string, lat: number, lng: number, photoReferences: string[], distanceM: number } | null>}
 */
export async function findPlaceForVenue(
  venue,
  cityLabel,
  apiKey,
  { excludePlaceIds = null, excludeAddresses = null } = {},
) {
  const lat = venue.latitude;
  const lng = venue.longitude;
  if (lat == null || lng == null || Number.isNaN(Number(lat))) {
    throw new Error(`${venue.slug}: missing latitude/longitude before Places lookup`);
  }

  const target = { lat: Number(lat), lng: Number(lng) };
  const [nearby, textNear] = await Promise.all([
    nearbySearchNearVenue(venue, apiKey),
    textSearchNearVenue(venue, apiKey),
  ]);

  const ranked = rankPlacesByDistance(dedupePlacesById([...nearby, ...textNear]), target);
  if (!ranked.length) {
    log(
      "google",
      `No POI within ~${NEARBY_RADIUS_M}m of (${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}) for ${venue.slug} in ${cityLabel}`,
    );
    return null;
  }

  const skippedIds = excludePlaceIds?.size ?? 0;
  const skippedAddr = excludeAddresses?.size ?? 0;
  const baseLimit = venue.photoPool === "restaurant" ? 24 : 12;
  const candidateLimit = Math.min(
    ranked.length,
    Math.max(baseLimit, baseLimit + skippedIds * 2 + skippedAddr * 2),
  );

  for (const { place, distanceM } of ranked.slice(0, candidateLimit)) {
    if (excludePlaceIds?.has(place.place_id)) continue;

    const resolved = await resolvePlaceCandidate(place, venue, apiKey, distanceM);
    if (!resolved) continue;

    const addrKey = normalizeListingAddress(resolved.formatted_address);
    if (excludeAddresses?.size && addrKey && excludeAddresses.has(addrKey)) {
      log("google", `Skip "${resolved.name}" — address already in business_cards`);
      excludePlaceIds?.add(resolved.placeId);
      continue;
    }

    log(
      "google",
      `Matched "${resolved.name}" @ ${resolved.formatted_address} (${resolved.distanceM}m from seed point)`,
    );
    return resolved;
  }

  if (venue.photoPool === "restaurant") {
    log(
      "google",
      `No upscale restaurant with photos within ~${NEARBY_RADIUS_M}m of (${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}) for ${venue.slug} in ${cityLabel}`,
    );
  } else {
    log("google", `Candidates near (${target.lat}, ${target.lng}) lack photos (${venue.slug})`);
  }
  return null;
}

/**
 * Finds a Google POI by venue name (Text Search) instead of random nearby POIs.
 * @returns {Promise<{ placeId: string, name: string, formatted_address: string, lat: number, lng: number, photoReferences: string[], distanceM: number } | null>}
 */
export async function findPlaceByName(
  placeName,
  cityLabel,
  apiKey,
  { venue, excludePlaceIds = null, excludeAddresses = null } = {},
) {
  const trimmedName = placeName?.trim();
  if (!trimmedName) {
    throw new Error("findPlaceByName: empty place name");
  }
  if (!venue) {
    throw new Error("findPlaceByName: venue template is required for photo-pool filters");
  }

  const results = await textSearchByPlaceName(trimmedName, cityLabel, apiKey);
  const ranked = rankPlacesByName(results, trimmedName);
  if (!ranked.length) {
    log("google", `No Text Search hits for "${trimmedName}" in ${cityLabel}`);
    return null;
  }

  const candidateLimit = Math.min(ranked.length, venue.photoPool === "restaurant" ? 12 : 8);

  for (const place of ranked.slice(0, candidateLimit)) {
    if (excludePlaceIds?.has(place.place_id)) continue;

    const resolved = await resolvePlaceCandidate(place, venue, apiKey, 0);
    if (!resolved) continue;

    const addrKey = normalizeListingAddress(resolved.formatted_address);
    if (excludeAddresses?.size && addrKey && excludeAddresses.has(addrKey)) {
      log("google", `Skip "${resolved.name}" — address already in business_cards`);
      excludePlaceIds?.add(resolved.placeId);
      continue;
    }

    log(
      "google",
      `Matched by name "${trimmedName}" → "${resolved.name}" @ ${resolved.formatted_address}`,
    );
    return { ...resolved, source: "textsearch-name" };
  }

  log("google", `No usable Google POI for "${trimmedName}" in ${cityLabel} (photos/filter/dedupe)`);
  return null;
}

/**
 * Resolves a Google Maps share URL to a full Places candidate (details + photos).
 * @returns {Promise<{ place: import('./googleMaps.mjs').GooglePlaceCandidate | null, failure: { reason: string, details?: string, placeName?: string } | null }>}
 */
export async function findPlaceFromMapsLink(
  mapsLink,
  apiKey,
  { venue, excludePlaceIds = null, excludeAddresses = null, allowDuplicate = false } = {},
) {
  const trimmedLink = mapsLink?.trim();
  if (!trimmedLink) {
    throw new Error("findPlaceFromMapsLink: empty Maps URL");
  }
  if (!venue) {
    throw new Error("findPlaceFromMapsLink: venue template is required");
  }

  const expandedUrl = await expandMapsShortUrl(trimmedLink);
  const placeId = await resolvePlaceIdFromMapsUrl(expandedUrl, apiKey);
  if (!placeId) {
    log("google", `Could not resolve place_id from Maps URL: ${trimmedLink.slice(0, 120)}`);
    return {
      place: null,
      failure: {
        reason: "unresolved",
        details: "Google could not map this share link to a Places place_id (try the full maps.google.com URL)",
      },
    };
  }

  if (excludePlaceIds?.has(placeId)) {
    log("google", `Skip Maps link — place_id already used in this run`);
    return {
      place: null,
      failure: { reason: "used_in_run", details: "same Google place_id already seeded in this command" },
    };
  }

  const detailed = await loadPlaceDetails(placeId, apiKey, "details:maps-link");
  if (!detailed) {
    log("google", `Place Details returned no data for Maps URL (${placeId})`);
    return {
      place: null,
      failure: { reason: "no_details", details: `Place Details empty for ${placeId}` },
    };
  }

  const resolved = await resolvePlaceCandidate(detailed, venue, apiKey, 0, { skipVenueFilter: true });
  if (!resolved) {
    log("google", `Maps URL resolved to "${detailed.name ?? placeId}" but place lacks usable photos`);
    return {
      place: null,
      failure: {
        reason: "no_photos",
        placeName: detailed.name ?? null,
        details: "Google place has no downloadable photos in Places API",
      },
    };
  }

  const addrKey = normalizeListingAddress(resolved.formatted_address);
  if (!allowDuplicate && excludeAddresses?.size && addrKey && excludeAddresses.has(addrKey)) {
    log("google", `Skip "${resolved.name}" — address already in business_cards`);
    excludePlaceIds?.add(resolved.placeId);
    return {
      place: null,
      failure: {
        reason: "duplicate",
        placeName: resolved.name,
        details: "address already in business_cards (use --allow-duplicate to insert anyway)",
      },
    };
  }

  log(
    "google",
    `Matched Maps link → "${resolved.name}" @ ${resolved.formatted_address}${resolved.cityLabel ? ` (${resolved.cityLabel})` : ""}`,
  );
  return { place: { ...resolved, source: "maps-link" }, failure: null };
}

/** @typedef {{ placeId: string, name: string, formatted_address: string, cityLabel?: string | null, lat: number, lng: number, photoReferences: string[], phone?: string | null, distanceM: number, source: string, types?: string[], price_level?: number, newApiData?: object | null, cuisine_types?: string[], price_tier?: number | null, menu_items?: string[], external_booking_platform?: string | null, external_booking_url?: string | null }} GooglePlaceCandidate */

/** Tried in order when `maxBytes` is set (Places Photo scales by maxwidth). */
const PLACE_PHOTO_MAXWIDTH_STEPS = [1200, 960, 800, 640, 520, 420, 340, 280, 220];

async function fetchPlacePhotoAtWidth(photoReference, apiKey, maxwidth) {
  const url = `${BASE}/place/photo?${new URLSearchParams({
    maxwidth: String(maxwidth),
    photo_reference: photoReference,
    key: apiKey,
  })}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await withRetry(`place-photo:${maxwidth}`, async () => {
      const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
      if (res.status === 429) {
        const err = new Error(`HTTP 429`);
        err.status = 429;
        throw err;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 8_000) throw new Error(`too small (${buf.byteLength} bytes)`);
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      return {
        bytes: toNodeBuffer(buf),
        contentType: contentType.split(";")[0].trim() || "image/jpeg",
        maxwidth,
      };
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ maxBytes?: number | null }} [options] — when set, downscale via lower `maxwidth` until size fits (or throw).
 * @returns {Promise<{ bytes: Buffer, contentType: string, maxwidth: number }>}
 */
export async function fetchPlacePhotoBytes(photoReference, apiKey, { maxBytes = null } = {}) {
  const widths = maxBytes ? PLACE_PHOTO_MAXWIDTH_STEPS : [1400];
  const attempts = [];

  for (const maxwidth of widths) {
    try {
      const payload = await fetchPlacePhotoAtWidth(photoReference, apiKey, maxwidth);
      if (maxBytes == null || payload.bytes.byteLength <= maxBytes) {
        if (maxBytes && maxwidth !== widths[0]) {
          log(
            "google",
            `Photo resized to maxwidth=${maxwidth} (${Math.round(payload.bytes.byteLength / 1024)} KB ≤ ${Math.round(maxBytes / 1024)} KB cap)`,
          );
        }
        return payload;
      }
      attempts.push(`${maxwidth}px→${Math.round(payload.bytes.byteLength / 1024)}KB`);
    } catch (err) {
      attempts.push(`${maxwidth}px: ${err.message}`);
    }
  }

  if (maxBytes) {
    throw new Error(
      `photo still above ${Math.round(maxBytes / 1024)} KB after downscale (${attempts.join("; ")})`,
    );
  }
  throw new Error(`photo download failed (${attempts.join("; ")})`);
}
