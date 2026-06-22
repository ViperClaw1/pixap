import { geocodeCity } from "./googleMaps.mjs";
import { geocodeCityOsm } from "./openStreetMap.mjs";
import { log, normalizeSeedPhone, pickFrom } from "./lib.mjs";

/** Lowercase key → canonical `business_cards.city` label + center coordinates. */
export const CITY_PRESETS = {
  paris: { label: "Paris, France", lat: 48.8566, lng: 2.3522 },
  london: { label: "London, UK", lat: 51.5074, lng: -0.1278 },
  barcelona: { label: "Barcelona, Spain", lat: 41.3851, lng: 2.1734 },
  berlin: { label: "Berlin, Germany", lat: 52.52, lng: 13.405 },
  dubai: { label: "Dubai, UAE", lat: 25.2048, lng: 55.2708 },
  istanbul: { label: "Istanbul, Turkey", lat: 41.0082, lng: 28.9784 },
  lisbon: { label: "Lisbon, Portugal", lat: 38.7223, lng: -9.1393 },
  miami: { label: "Miami, USA", lat: 25.7617, lng: -80.1918 },
  moscow: { label: "Moscow, Russia", lat: 55.7558, lng: 37.6173 },
  tokyo: { label: "Tokyo, Japan", lat: 35.6762, lng: 139.6503 },
  amsterdam: { label: "Amsterdam, Netherlands", lat: 52.3676, lng: 4.9041 },
  rome: { label: "Rome, Italy", lat: 41.9028, lng: 12.4964 },
  "new york": { label: "New York, USA", lat: 40.7128, lng: -74.006 },
};

/** Display names accepted by `--city` and used when randomizing. */
export const SEED_CITY_POOL = [
  "Paris",
  "London",
  "Barcelona",
  "Berlin",
  "Dubai",
  "Istanbul",
  "Lisbon",
  "Miami",
  "Moscow",
  "Tokyo",
  "Amsterdam",
  "Rome",
  "New York",
];

function presetKey(cityInput) {
  return cityInput.trim().toLowerCase();
}

/** Common typos / shorthand for `--city`. */
const CITY_ALIASES = {
  istambul: "istanbul",
  instanbul: "istanbul",
  stambul: "istanbul",
  nyc: "new york",
  "new-york": "new york",
  spb: "saint petersburg",
  "saint-petersburg": "saint petersburg",
  almaty: "almaty",
  almaata: "almaty",
  yerevan: "yerevan",
};

export function normalizeCityInput(cityInput) {
  const trimmed = cityInput?.trim();
  if (!trimmed) return trimmed;
  const key = presetKey(trimmed);
  return CITY_ALIASES[key] ?? trimmed;
}

/**
 * @param {string} cityInput
 * @param {string | null} googleApiKey
 * @param {"google" | "osm"} [source]
 * @returns {Promise<{ label: string, lat: number, lng: number }>}
 */
export async function resolveCity(cityInput, googleApiKey, source = "google") {
  const normalized = normalizeCityInput(cityInput);
  const key = presetKey(normalized);
  const preset = CITY_PRESETS[key];
  if (preset) return { ...preset };

  if (source === "osm") {
    log("city", `Geocoding "${normalized}" via Nominatim…`);
    return geocodeCityOsm(normalized);
  }

  if (!googleApiKey) {
    throw new Error(
      `Unknown city "${normalized}". Use one of: ${SEED_CITY_POOL.join(", ")} — or set EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY for geocoding, or use --source osm.`,
    );
  }

  log("city", `Geocoding "${normalized}" via Google…`);
  return geocodeCity(normalized, googleApiKey);
}

const GEO_SLOT_SPREAD = 0.04;
const GEO_SLOT_PHI = 0.618033988749895;

/** Deterministic offset from city center; `slotIndex` shifts on repeat runs (existing rows in city). */
function jitterCoordinates(lat, lng, slotIndex) {
  const a = (slotIndex * GEO_SLOT_PHI) % 1;
  const b = (slotIndex * (1 - GEO_SLOT_PHI)) % 1;
  return {
    lat: lat + (a - 0.5) * GEO_SLOT_SPREAD,
    lng: lng + (b - 0.5) * GEO_SLOT_SPREAD,
  };
}

/** Apply city label + jittered coordinates when no Google place was matched. */
export function applyCityCenterToVenue(venue, cityResolved, slotIndex) {
  const { lat, lng } = jitterCoordinates(cityResolved.lat, cityResolved.lng, slotIndex);
  const cityShort = cityResolved.label.split(",")[0]?.trim() ?? cityResolved.label;
  const { _googlePlace: _g, _osmPlace: _o, ...template } = venue;
  return {
    ...template,
    city: cityResolved.label,
    latitude: lat,
    longitude: lng,
    address: `${10 + slotIndex * 7} ${venue.name.en} St, ${cityShort}`,
  };
}

/** Override geo + contact fields from a Google Places result. */
export function applyGooglePlaceToVenue(venue, place) {
  const phone =
    place.phone ?? normalizeSeedPhone(venue.phone) ?? venue.phone;
  const contact_whatsapp = phone ?? normalizeSeedPhone(venue.contact_whatsapp) ?? venue.contact_whatsapp;

  return {
    ...venue,
    city: place.cityLabel ?? venue.city,
    address: place.formatted_address,
    latitude: place.lat,
    longitude: place.lng,
    phone,
    contact_whatsapp,
    _googlePlace: place,
    _osmPlace: undefined,
  };
}

/** Override geo + contact fields from an OpenStreetMap POI. */
export function applyOsmPlaceToVenue(venue, place) {
  const phone = place.phone ?? normalizeSeedPhone(venue.phone) ?? venue.phone;
  const contact_whatsapp = phone ?? normalizeSeedPhone(venue.contact_whatsapp) ?? venue.contact_whatsapp;

  return {
    ...venue,
    city: place.cityLabel ?? venue.city,
    address: place.formatted_address,
    latitude: place.lat,
    longitude: place.lng,
    phone,
    contact_whatsapp,
    _osmPlace: place,
    _googlePlace: undefined,
  };
}

/** @returns {string[]} display city names (unique when pool size allows) */
export function pickRandomCityNames(rng, count) {
  const pool = [...SEED_CITY_POOL];
  const picked = [];
  while (picked.length < count) {
    if (!pool.length) {
      picked.push(pickFrom(rng, SEED_CITY_POOL));
      continue;
    }
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

/**
 * @param {string[]} cityNames
 * @param {string | null} googleApiKey
 * @param {"google" | "osm"} [source]
 * @returns {Promise<Array<{ label: string, lat: number, lng: number }>>}
 */
export async function resolveCityList(cityNames, googleApiKey, source = "google") {
  const cache = new Map();
  const out = [];
  for (const name of cityNames) {
    const key = presetKey(name);
    if (!cache.has(key)) {
      cache.set(key, await resolveCity(name, googleApiKey, source));
    }
    out.push(cache.get(key));
  }
  return out;
}
