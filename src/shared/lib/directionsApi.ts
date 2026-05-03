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
  error_message?: string;
  results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
};

const BASE = "https://maps.googleapis.com/maps/api";

function debugMapsApi(event: string, payload?: unknown) {
  if (!__DEV__) return;
  if (payload === undefined) {
    console.log(`[MapsApi][debug] ${event}`);
    return;
  }
  console.log(`[MapsApi][debug] ${event}`, payload);
}

/**
 * Geocode a free-text address to coordinates (for destination pin / map center).
 * REQUIRES: Geocoding API enabled for the key.
 */
export type GeocodeAddressResult =
  | { ok: true; location: LatLng }
  | { ok: false; status: string; message?: string };

export async function geocodeAddressDetailed(
  address: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<GeocodeAddressResult> {
  const q = new URLSearchParams({
    address,
    key: apiKey,
  });
  const url = `${BASE}/geocode/json?${q.toString()}`;
  const res = await fetch(url, { signal });
  const data = (await res.json()) as GoogleGeocodeResponse;
  debugMapsApi("geocode:response", {
    httpOk: res.ok,
    httpStatus: res.status,
    status: data.status,
    errorMessage: data.error_message,
    hasResult: Boolean(data.results?.[0]),
  });
  if (data.status !== "OK" || !data.results?.[0]) {
    return {
      ok: false,
      status: data.status,
      message: data.error_message ?? data.status,
    };
  }
  const loc = data.results[0].geometry.location;
  return { ok: true, location: { latitude: loc.lat, longitude: loc.lng } };
}

export async function geocodeAddress(address: string, apiKey: string): Promise<LatLng | null> {
  const result = await geocodeAddressDetailed(address, apiKey);
  return result.ok ? result.location : null;
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
  signal?: AbortSignal;
}): Promise<{ ok: true; data: DirectionsResult } | { ok: false; status: string; message?: string }> {
  const { apiKey, origin, destination, mode, signal } = params;
  const q = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination,
    mode,
    key: apiKey,
  });

  const url = `${BASE}/directions/json?${q.toString()}`;
  const res = await fetch(url, { signal });
  const data = (await res.json()) as GoogleDirectionsResponse;
  debugMapsApi("directions:response", {
    httpOk: res.ok,
    httpStatus: res.status,
    status: data.status,
    errorMessage: data.error_message,
    hasRoute: Boolean(data.routes?.[0]),
  });

  if (data.status !== "OK" || !data.routes?.[0]) {
    return {
      ok: false,
      status: data.status,
      message: data.error_message ?? data.status,
    };
  }

  const route = data.routes[0];
  const encoded = route.overview_polyline?.points;
  const leg = route.legs?.[0];
  let coordinates: LatLng[] = [];
  if (encoded) {
    try {
      coordinates = decodeGooglePolyline(encoded);
    } catch (e) {
      if (__DEV__) {
        console.log("[MapsApi][debug] directions:polyline_decode_error", {
          error: e instanceof Error ? e.message : String(e),
          encodedLength: encoded.length,
        });
      }
      coordinates = [];
    }
  } else if (__DEV__) {
    console.log("[MapsApi][debug] directions:no_polyline");
  }
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
  if (__DEV__) {
    console.log("[MapsApi][debug] directions:payload_summary", {
      mode,
      coordinatesCount: coordinates.length,
      hasLeg: Boolean(leg),
      hasStart: Boolean(startLocation),
      hasEnd: Boolean(endLocation),
      durationText,
      distanceText,
    });
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
