import { normalizeListingAddress } from "./dedupe.mjs";
import { assessUpscaleRestaurant } from "./googleRestaurantFilter.mjs";
import { log, normalizeSeedPhone, sleep, toNodeBuffer } from "./lib.mjs";

const BASE = "https://maps.googleapis.com/maps/api";
const API_DELAY_MS = 200;
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
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`${label}: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`);
    }
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

async function loadPlaceDetails(placeId, apiKey, label) {
  const details = await mapsGet(
    "place/details/json",
    {
      place_id: placeId,
      fields:
        "place_id,name,formatted_address,geometry,photos,business_status,types,price_level,formatted_phone_number,international_phone_number",
      key: apiKey,
    },
    label,
  );
  return details.result ?? null;
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

async function resolvePlaceCandidate(candidate, venue, apiKey, distanceM) {
  let place = candidate;

  if (place.place_id) {
    const detailed = await loadPlaceDetails(place.place_id, apiKey, `details:${venue.slug}`);
    if (detailed) place = { ...place, ...detailed };
  }

  const filter = passesVenuePlaceFilter(place, venue);
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

  return {
    placeId: place.place_id,
    name,
    formatted_address,
    lat: loc.lat,
    lng: loc.lng,
    photoReferences,
    phone,
    distanceM: Math.round(distanceM),
    source: "nearby",
    types: place.types,
    price_level: place.price_level,
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

/** @typedef {{ placeId: string, name: string, formatted_address: string, lat: number, lng: number, photoReferences: string[], phone?: string | null, distanceM: number, source: string, types?: string[], price_level?: number }} GooglePlaceCandidate */

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
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 8_000) throw new Error(`too small (${buf.byteLength} bytes)`);
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return {
      bytes: toNodeBuffer(buf),
      contentType: contentType.split(";")[0].trim() || "image/jpeg",
      maxwidth,
    };
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
