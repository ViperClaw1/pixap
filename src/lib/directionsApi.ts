import { decodeGooglePolyline, type LatLng } from "./polylineDecode";

export type TravelMode = "driving" | "walking" | "transit";

export type DirectionsResult = {
  coordinates: LatLng[];
  durationText: string | null;
  distanceText: string | null;
  startLocation: LatLng | null;
  endLocation: LatLng | null;
};

type GoogleDirectionsResponse = {
  status: string;
  error_message?: string;
  routes?: Array<{
    overview_polyline?: { points?: string };
    legs?: Array<{
      duration?: { text?: string };
      distance?: { text?: string };
      start_location?: { lat: number; lng: number };
      end_location?: { lat: number; lng: number };
    }>;
  }>;
};

type GoogleGeocodeResponse = {
  status: string;
  results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
};

const BASE = "https://maps.googleapis.com/maps/api";

/**
 * Geocode a free-text address to coordinates (for destination pin / map center).
 * REQUIRES: Geocoding API enabled for the key.
 */
export async function geocodeAddress(address: string, apiKey: string): Promise<LatLng | null> {
  const q = new URLSearchParams({
    address,
    key: apiKey,
  });
  const url = `${BASE}/geocode/json?${q.toString()}`;
  const res = await fetch(url);
  const data = (await res.json()) as GoogleGeocodeResponse;
  if (data.status !== "OK" || !data.results?.[0]) {
    return null;
  }
  const loc = data.results[0].geometry.location;
  return { latitude: loc.lat, longitude: loc.lng };
}

/**
 * Directions from origin coordinates to destination (coordinates or address string).
 * REQUIRES: Directions API enabled for the key.
 */
export async function fetchDirections(params: {
  apiKey: string;
  origin: LatLng;
  destination: string;
  mode: TravelMode;
}): Promise<{ ok: true; data: DirectionsResult } | { ok: false; status: string; message?: string }> {
  const { apiKey, origin, destination, mode } = params;
  const q = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination,
    mode,
    key: apiKey,
  });

  const url = `${BASE}/directions/json?${q.toString()}`;
  const res = await fetch(url);
  const data = (await res.json()) as GoogleDirectionsResponse;

  if (data.status !== "OK" || !data.routes?.[0]) {
    return {
      ok: false,
      status: data.status,
      message: data.error_message ?? data.status,
    };
  }

  const route = data.routes[0];
  const encoded = route.overview_polyline?.points;
  if (!encoded) {
    return { ok: false, status: "NO_POLYLINE", message: "No route geometry" };
  }

  const coordinates = decodeGooglePolyline(encoded);
  const leg = route.legs?.[0];
  let durationText: string | null = null;
  let distanceText: string | null = null;
  let startLocation: LatLng | null = null;
  let endLocation: LatLng | null = null;

  if (leg) {
    durationText = leg.duration?.text ?? null;
    distanceText = leg.distance?.text ?? null;
    if (leg.start_location) {
      startLocation = { latitude: leg.start_location.lat, longitude: leg.start_location.lng };
    }
    if (leg.end_location) {
      endLocation = { latitude: leg.end_location.lat, longitude: leg.end_location.lng };
    }
  }

  return {
    ok: true,
    data: {
      coordinates,
      durationText,
      distanceText,
      startLocation,
      endLocation,
    },
  };
}
