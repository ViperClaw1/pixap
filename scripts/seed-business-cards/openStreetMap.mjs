import { normalizeListingAddress } from "./dedupe.mjs";
import { assessUpscaleRestaurant } from "./googleRestaurantFilter.mjs";
import { deriveMenuItemsFromCuisineTypes } from "./googleMaps.mjs";
import { log, normalizeSeedPhone, sleep, withRetry } from "./lib.mjs";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const OVERPASS_BASE = "https://overpass-api.de/api/interpreter";
const WIKIMEDIA_API = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/wiki/Special:EntityData";

const API_DELAY_MS = 1100;
const REQUEST_TIMEOUT_MS = 45_000;
const NEARBY_RADIUS_M = 280;

const USER_AGENT = "PixapSeedBusinessCards/1.0 (https://github.com/pixap; seed-script)";

/** venue `photoPool` → Overpass filter fragments. */
export const VENUE_OSM_FILTERS = {
  restaurant: { amenity: "restaurant" },
  cafe: { amenity: "cafe" },
  bar: { amenity: ["bar", "pub"] },
  hotel: { tourism: "hotel" },
  gym: { leisure: "fitness_centre" },
  beauty: { shop: "beauty", amenity: "hairdresser" },
  coworking: { office: "coworking" },
  club: { amenity: "nightclub" },
  hookah: { amenity: ["hookah_lounge", "shisha"] },
};

const FAST_FOOD_AMENITIES = new Set(["fast_food", "food_court"]);

async function osmFetch(url, label, { method = "GET", body = null, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const data = await withRetry(label, async () => {
      const res = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          ...headers,
        },
        body,
      });
      if (res.status === 429) {
        const err = new Error(`${label}: HTTP 429`);
        err.status = 429;
        throw err;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${label}: HTTP ${res.status}${text ? ` — ${text.slice(0, 120)}` : ""}`);
      }
      return res.json();
    });
    await sleep(API_DELAY_MS);
    return data;
  } finally {
    clearTimeout(timer);
  }
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

function elementLatLng(element) {
  if (element.type === "node" && element.lat != null && element.lon != null) {
    return { lat: element.lat, lng: element.lon };
  }
  const center = element.center;
  if (center?.lat != null && center.lon != null) {
    return { lat: center.lat, lng: center.lon };
  }
  return null;
}

function osmPlaceKey(type, id) {
  return `osm:${type}:${id}`;
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

function rankByName(results, queryName) {
  return [...results].sort((left, right) => {
    const scoreDiff =
      scorePlaceNameMatch(left.name, queryName) - scorePlaceNameMatch(right.name, queryName);
    if (scoreDiff !== 0) return scoreDiff;
    return (right.distanceM ?? 0) - (left.distanceM ?? 0);
  });
}

function buildAddressFromTags(tags, displayName) {
  const parts = [
    tags["addr:street"] && tags["addr:housenumber"]
      ? `${tags["addr:street"]} ${tags["addr:housenumber"]}`
      : tags["addr:street"],
    tags["addr:suburb"] ?? tags["addr:neighbourhood"],
    tags["addr:postcode"],
    tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"],
    tags["addr:country"],
  ]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);

  if (parts.length) return parts.join(", ");
  return displayName?.trim() ?? tags.name?.trim() ?? "";
}

export function cityLabelFromNominatimResult(result) {
  const addr = result.address ?? {};
  const isTurkey =
    addr.country_code?.toUpperCase() === "TR" || /^(turkey|türkiye)$/i.test(addr.country ?? "");
  const locality =
    addr.city ??
    addr.town ??
    addr.village ??
    addr.municipality ??
    (isTurkey ? addr.state ?? addr.county : addr.county ?? addr.state);
  const country = addr.country;
  if (locality && country) return `${locality}, ${country}`;
  if (result.display_name) {
    const parts = result.display_name.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }
  return null;
}

function cityLabelFromTags(tags) {
  const locality = tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"];
  const country = tags["addr:country"];
  if (locality && country) return `${locality}, ${country}`;
  return null;
}

function extractCuisineTypesFromTags(tags) {
  const raw = tags.cuisine ?? tags["cuisine:en"] ?? "";
  if (!raw.trim()) return [];
  return raw
    .split(/[;,]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function osmTypesFromTags(tags) {
  const types = [];
  for (const key of ["amenity", "tourism", "leisure", "shop", "office"]) {
    const value = tags[key];
    if (value) types.push(String(value));
  }
  return types;
}

function passesVenueOsmFilter(element, venue) {
  const tags = element.tags ?? {};
  const name = tags.name?.trim() ?? tags["name:en"]?.trim();
  if (!name) return { ok: false, reason: "no name tag" };

  const amenity = tags.amenity;
  if (FAST_FOOD_AMENITIES.has(amenity)) {
    return { ok: false, reason: `fast food amenity "${amenity}"` };
  }

  if (venue.photoPool === "restaurant") {
    const assessment = assessUpscaleRestaurant({
      name,
      types: osmTypesFromTags(tags),
      price_level: null,
    });
    if (!assessment.ok) return assessment;
  }

  return { ok: true };
}

function buildOverpassFilter(photoPool) {
  const spec = VENUE_OSM_FILTERS[photoPool] ?? VENUE_OSM_FILTERS.restaurant;
  const clauses = [];

  for (const [key, value] of Object.entries(spec)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      clauses.push(`  node["${key}"="${v}"](around:${NEARBY_RADIUS_M},{lat},{lng});`);
      clauses.push(`  way["${key}"="${v}"](around:${NEARBY_RADIUS_M},{lat},{lng});`);
    }
  }

  return clauses.join("\n");
}

async function overpassSearchNear(lat, lng, photoPool, label) {
  const filter = buildOverpassFilter(photoPool);
  const query = `[out:json][timeout:25];
(
${filter.replaceAll("{lat}", String(lat)).replaceAll("{lng}", String(lng))}
);
out center tags;`;

  const data = await osmFetch(OVERPASS_BASE, label, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data.elements ?? [];
}

async function nominatimSearch(query, label, extraParams = {}) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "10",
    ...extraParams,
  });
  const url = `${NOMINATIM_BASE}/search?${params.toString()}`;
  return osmFetch(url, label);
}

async function overpassFetchElement(osmType, osmId, label) {
  const query = `[out:json][timeout:25];
${osmType}(${osmId});
out center tags;`;
  const data = await osmFetch(OVERPASS_BASE, label, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data.elements?.[0] ?? null;
}

async function nominatimLookup(osmType, osmId, label) {
  const params = new URLSearchParams({
    osm_ids: `${osmType[0].toUpperCase()}${osmId}`,
    format: "jsonv2",
    addressdetails: "1",
  });
  const url = `${NOMINATIM_BASE}/lookup?${params.toString()}`;
  const results = await osmFetch(url, label);
  return results?.[0] ?? null;
}

async function fetchWikimediaFileUrl(fileTitle) {
  const title = fileTitle.startsWith("File:") ? fileTitle : `File:${fileTitle}`;
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "1200",
    format: "json",
  });
  const data = await osmFetch(`${WIKIMEDIA_API}?${params.toString()}`, `wikimedia:${title}`);
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0];
  const info = page?.imageinfo?.[0];
  return info?.thumburl ?? info?.url ?? null;
}

async function fetchWikidataImageUrl(wikidataId) {
  const qid = wikidataId.replace(/^Q/i, "Q");
  const url = `${WIKIDATA_API}/${qid}.json`;
  const data = await osmFetch(url, `wikidata:${qid}`);
  const entity = data.entities?.[qid];
  const imageName = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (!imageName) return null;
  return fetchWikimediaFileUrl(imageName);
}

/**
 * Collect direct image URLs from OSM tags (image, wikimedia_commons, wikidata).
 * @returns {Promise<string[]>}
 */
export async function resolveOsmImageUrls(tags) {
  const urls = new Set();

  const directImage = tags.image?.trim();
  if (directImage?.startsWith("http")) urls.add(directImage);

  const commons = tags.wikimedia_commons?.trim();
  if (commons) {
    if (commons.startsWith("http")) {
      urls.add(commons);
    } else if (commons.startsWith("File:") || !commons.includes(":")) {
      const fileUrl = await fetchWikimediaFileUrl(commons);
      if (fileUrl) urls.add(fileUrl);
    }
  }

  const wikidata = tags.wikidata?.trim();
  if (wikidata) {
    const wdUrl = await fetchWikidataImageUrl(wikidata);
    if (wdUrl) urls.add(wdUrl);
  }

  return [...urls];
}

async function resolveOsmCandidate(element, venue, distanceM, { skipVenueFilter = false } = {}) {
  const tags = element.tags ?? {};
  const filter = skipVenueFilter ? { ok: true } : passesVenueOsmFilter(element, venue);
  if (!filter.ok) return null;

  const loc = elementLatLng(element);
  if (!loc) return null;

  const name = tags.name?.trim() ?? tags["name:en"]?.trim();
  const formatted_address = buildAddressFromTags(tags, element.display_name);
  if (!name || !formatted_address) return null;

  const phone = normalizeSeedPhone(tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? null);
  const cuisine_types = extractCuisineTypesFromTags(tags);
  const imageUrls = await resolveOsmImageUrls(tags);

  return {
    placeId: osmPlaceKey(element.type, element.id),
    osmType: element.type,
    osmId: element.id,
    name,
    formatted_address,
    cityLabel: cityLabelFromTags(tags),
    lat: loc.lat,
    lng: loc.lng,
    photoReferences: [],
    imageUrls,
    phone,
    distanceM: Math.round(distanceM),
    source: "overpass",
    types: osmTypesFromTags(tags),
    cuisine_types,
    price_tier: null,
    menu_items: deriveMenuItemsFromCuisineTypes(cuisine_types),
  };
}

function nominatimResultToElement(result) {
  const osmType = result.osm_type;
  const osmId = Number(result.osm_id);
  if (!osmType || !Number.isFinite(osmId)) return null;

  return {
    type: osmType,
    id: osmId,
    lat: Number(result.lat),
    lon: Number(result.lon),
    tags: {
      name: result.name ?? result.display_name?.split(",")[0],
      ...Object.fromEntries(
        Object.entries(result.address ?? {}).map(([k, v]) => [`addr:${k}`, v]),
      ),
      phone: result.extratags?.phone,
      cuisine: result.extratags?.cuisine,
      wikidata: result.extratags?.wikidata,
      image: result.extratags?.image,
      wikimedia_commons: result.extratags?.wikimedia_commons,
      amenity: result.type === "amenity" ? result.class : result.extratags?.amenity,
    },
    display_name: result.display_name,
  };
}

async function resolveNominatimCandidate(result, venue, distanceM, options) {
  const element = nominatimResultToElement(result);
  if (!element) return null;
  const candidate = await resolveOsmCandidate(element, venue, distanceM, options);
  if (!candidate) return null;
  return { ...candidate, cityLabel: cityLabelFromNominatimResult(result) ?? candidate.cityLabel };
}

/**
 * @returns {{ label: string, lat: number, lng: number }}
 */
export async function geocodeCityOsm(cityName) {
  const results = await nominatimSearch(cityName, `nominatim:geocode:${cityName}`, { limit: "1" });
  const hit = results?.[0];
  if (!hit?.lat || !hit?.lon) {
    throw new Error(`nominatim: no results for "${cityName}"`);
  }
  const label = cityLabelFromNominatimResult(hit) ?? cityName.trim();
  return { label, lat: Number(hit.lat), lng: Number(hit.lon) };
}

/**
 * @returns {Promise<import('./openStreetMap.mjs').OsmPlaceCandidate | null>}
 */
export async function findPlaceForVenue(
  venue,
  cityLabel,
  { excludePlaceIds = null, excludeAddresses = null } = {},
) {
  const lat = venue.latitude;
  const lng = venue.longitude;
  if (lat == null || lng == null || Number.isNaN(Number(lat))) {
    throw new Error(`${venue.slug}: missing latitude/longitude before OSM lookup`);
  }

  const target = { lat: Number(lat), lng: Number(lng) };
  const elements = await overpassSearchNear(
    target.lat,
    target.lng,
    venue.photoPool,
    `overpass:${venue.slug}@${cityLabel}`,
  );

  const ranked = elements
    .map((element) => {
      const loc = elementLatLng(element);
      if (!loc) return null;
      return { element, distanceM: haversineMeters(target, loc) };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceM - b.distanceM);

  if (!ranked.length) {
    log(
      "osm",
      `No POI within ~${NEARBY_RADIUS_M}m of (${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}) for ${venue.slug} in ${cityLabel}`,
    );
    return null;
  }

  const candidateLimit = venue.photoPool === "restaurant" ? 24 : 12;

  for (const { element, distanceM } of ranked.slice(0, candidateLimit)) {
    const key = osmPlaceKey(element.type, element.id);
    if (excludePlaceIds?.has(key)) continue;

    const resolved = await resolveOsmCandidate(element, venue, distanceM);
    if (!resolved) continue;

    const addrKey = normalizeListingAddress(resolved.formatted_address);
    if (excludeAddresses?.size && addrKey && excludeAddresses.has(addrKey)) {
      log("osm", `Skip "${resolved.name}" — address already in business_cards`);
      excludePlaceIds?.add(resolved.placeId);
      continue;
    }

    log(
      "osm",
      `Matched "${resolved.name}" @ ${resolved.formatted_address} (${resolved.distanceM}m from seed point, ${resolved.imageUrls.length} image tag(s))`,
    );
    return resolved;
  }

  log("osm", `No usable OSM POI near (${target.lat}, ${target.lng}) for ${venue.slug}`);
  return null;
}

/**
 * @returns {Promise<import('./openStreetMap.mjs').OsmPlaceCandidate | null>}
 */
export async function findPlaceByName(
  placeName,
  cityLabel,
  { venue, excludePlaceIds = null, excludeAddresses = null } = {},
) {
  const trimmedName = placeName?.trim();
  if (!trimmedName) throw new Error("findPlaceByName: empty place name");
  if (!venue) throw new Error("findPlaceByName: venue template is required");

  const cityShort = cityLabel.split(",")[0]?.trim() ?? cityLabel.trim();
  const query = cityShort ? `${trimmedName}, ${cityShort}` : trimmedName;
  const results = await nominatimSearch(query, `nominatim:name:${trimmedName}`, { limit: "8" });
  const ranked = rankByName(
    (results ?? []).map((r) => ({ ...r, name: r.name ?? r.display_name?.split(",")[0] ?? "" })),
    trimmedName,
  );

  if (!ranked.length) {
    log("osm", `No Nominatim hits for "${trimmedName}" in ${cityLabel}`);
    return null;
  }

  const candidateLimit = venue.photoPool === "restaurant" ? 12 : 8;

  for (const result of ranked.slice(0, candidateLimit)) {
    const element = nominatimResultToElement(result);
    if (!element) continue;
    const key = osmPlaceKey(element.type, element.id);
    if (excludePlaceIds?.has(key)) continue;

    const resolved = await resolveNominatimCandidate(result, venue, 0);
    if (!resolved) continue;

    const addrKey = normalizeListingAddress(resolved.formatted_address);
    if (excludeAddresses?.size && addrKey && excludeAddresses.has(addrKey)) {
      log("osm", `Skip "${resolved.name}" — address already in business_cards`);
      excludePlaceIds?.add(resolved.placeId);
      continue;
    }

    log("osm", `Matched by name "${trimmedName}" → "${resolved.name}" @ ${resolved.formatted_address}`);
    return { ...resolved, source: "nominatim-name" };
  }

  log("osm", `No usable OSM POI for "${trimmedName}" in ${cityLabel}`);
  return null;
}

const OSM_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?openstreetmap\.org\/(?:node|way|relation)\/(\d+)/i;

export function isOpenStreetMapUrl(value) {
  return OSM_URL_RE.test(String(value ?? "").trim());
}

export function parseOsmUrl(urlString) {
  const match = String(urlString).trim().match(OSM_URL_RE);
  if (!match) return null;
  const typeMatch = urlString.match(/\/(node|way|relation)\/(\d+)/i);
  if (!typeMatch) return null;
  return { type: typeMatch[1].toLowerCase(), id: Number(typeMatch[2]) };
}

/**
 * @returns {Promise<{ place: import('./openStreetMap.mjs').OsmPlaceCandidate | null, failure: { reason: string, details?: string, placeName?: string } | null }>}
 */
export async function findPlaceFromOsmLink(
  osmLink,
  { venue, excludePlaceIds = null, excludeAddresses = null, allowDuplicate = false } = {},
) {
  const trimmedLink = osmLink?.trim();
  if (!trimmedLink) throw new Error("findPlaceFromOsmLink: empty OSM URL");
  if (!venue) throw new Error("findPlaceFromOsmLink: venue template is required");

  const parsed = parseOsmUrl(trimmedLink);
  if (!parsed) {
    return {
      place: null,
      failure: {
        reason: "unresolved",
        details: "URL must look like https://www.openstreetmap.org/node/123456789",
      },
    };
  }

  const placeKey = osmPlaceKey(parsed.type, parsed.id);
  if (excludePlaceIds?.has(placeKey)) {
    return {
      place: null,
      failure: { reason: "used_in_run", details: "same OSM id already seeded in this command" },
    };
  }

  const lookup = await nominatimLookup(parsed.type, parsed.id, `nominatim:lookup:${placeKey}`);
  let element = null;
  if (lookup) {
    element = nominatimResultToElement(lookup);
  } else {
    log("osm", `Nominatim lookup empty for ${placeKey} — trying Overpass`);
    element = await overpassFetchElement(parsed.type, parsed.id, `overpass:lookup:${placeKey}`);
  }

  if (!element) {
    log("osm", `Could not load OSM element ${placeKey}`);
    return {
      place: null,
      failure: { reason: "no_details", details: `OSM element not found for ${placeKey}` },
    };
  }

  const resolved = await resolveOsmCandidate(element, venue, 0, { skipVenueFilter: true });
  if (!resolved) {
    return {
      place: null,
      failure: {
        reason: "no_poi",
        placeName: element.tags?.name ?? null,
        details: "OSM element has no usable name/address tags",
      },
    };
  }

  if (lookup) {
    resolved.cityLabel = cityLabelFromNominatimResult(lookup) ?? resolved.cityLabel;
  }

  const addrKey = normalizeListingAddress(resolved.formatted_address);
  if (!allowDuplicate && excludeAddresses?.size && addrKey && excludeAddresses.has(addrKey)) {
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
    "osm",
    `Matched OSM link → "${resolved.name}" @ ${resolved.formatted_address}${resolved.cityLabel ? ` (${resolved.cityLabel})` : ""}`,
  );
  return { place: { ...resolved, source: "osm-link" }, failure: null };
}

/** @typedef {{ placeId: string, osmType: string, osmId: number, name: string, formatted_address: string, cityLabel?: string | null, lat: number, lng: number, photoReferences: string[], imageUrls: string[], phone?: string | null, distanceM: number, source: string, types?: string[], cuisine_types?: string[], price_tier?: number | null, menu_items?: string[] }} OsmPlaceCandidate */
