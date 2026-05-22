import { geocodeCity } from "./googleMaps.mjs";
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

/**
 * @returns {{ label: string, lat: number, lng: number }}
 */
export async function resolveCity(cityInput, googleApiKey) {
  const key = presetKey(cityInput);
  const preset = CITY_PRESETS[key];
  if (preset) return { ...preset };

  if (!googleApiKey) {
    throw new Error(
      `Unknown city "${cityInput}". Use one of: ${SEED_CITY_POOL.join(", ")} — or set EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY for geocoding.`,
    );
  }

  log("city", `Geocoding "${cityInput}" via Google…`);
  return geocodeCity(cityInput, googleApiKey);
}

/** ~±1.1 km from city center — enough variety, keeps Nearby Search meaningful. */
function jitterCoordinates(lat, lng, rng) {
  return {
    lat: lat + (rng() - 0.5) * 0.02,
    lng: lng + (rng() - 0.5) * 0.02,
  };
}

/** Apply city label + jittered coordinates when no Google place was matched. */
export function applyCityCenterToVenue(venue, cityResolved, rng, index) {
  const { lat, lng } = jitterCoordinates(cityResolved.lat, cityResolved.lng, rng);
  const cityShort = cityResolved.label.split(",")[0]?.trim() ?? cityResolved.label;
  return {
    ...venue,
    city: cityResolved.label,
    latitude: lat,
    longitude: lng,
    address: `${10 + index * 7} ${venue.name.en} St, ${cityShort}`,
  };
}

/** Override geo + contact fields from a Google Places result. */
export function applyGooglePlaceToVenue(venue, place) {
  const phone =
    place.phone ?? normalizeSeedPhone(venue.phone) ?? venue.phone;
  const contact_whatsapp = phone ?? normalizeSeedPhone(venue.contact_whatsapp) ?? venue.contact_whatsapp;

  return {
    ...venue,
    address: place.formatted_address,
    latitude: place.lat,
    longitude: place.lng,
    phone,
    contact_whatsapp,
    _googlePlace: place,
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
 * @returns {Promise<Array<{ label: string, lat: number, lng: number }>>}
 */
export async function resolveCityList(cityNames, googleApiKey) {
  const cache = new Map();
  const out = [];
  for (const name of cityNames) {
    const key = presetKey(name);
    if (!cache.has(key)) {
      cache.set(key, await resolveCity(name, googleApiKey));
    }
    out.push(cache.get(key));
  }
  return out;
}
