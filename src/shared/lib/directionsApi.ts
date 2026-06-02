import Constants from "expo-constants";
import { Platform } from "react-native";
import { decodeGooglePolyline, type LatLng } from "./polylineDecode";
import { env } from "./env";
import { devLog } from "@/shared/lib/devLog";

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
      duration?: { text?: string; value?: number };
      distance?: { text?: string; value?: number };
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

/**
 * Google Maps Platform REST from mobile: with Android/iOS application key restrictions,
 * requests must include platform headers (see Maps API security best practices).
 * Expo Go (`appOwnership === "expo"`) skips them so dev matches unrestricted / Expo keys.
 */
export function buildGoogleMapsPlatformRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (Constants.appOwnership !== "expo") {
    if (Platform.OS === "ios") {
      const bid = Constants.expoConfig?.ios?.bundleIdentifier;
      if (bid) headers["X-Ios-Bundle-Identifier"] = bid;
    } else if (Platform.OS === "android") {
      const pkg = Constants.expoConfig?.android?.package;
      const cert = env.googleMapsAndroidCertSha1;
      if (pkg) headers["X-Android-Package"] = pkg;
      if (cert) headers["X-Android-Cert"] = cert;
    }
  }
  return headers;
}

export function googleMapsWebServiceFetch(url: string, signal?: AbortSignal): Promise<Response> {
  const headers = buildGoogleMapsPlatformRequestHeaders();
  const init: RequestInit = { signal };
  if (Object.keys(headers).length > 0) init.headers = headers;
  return fetch(url, init);
}

function debugMapsApi(event: string, payload?: unknown) {
  if (payload === undefined) {
    devLog(`[MapsApi][debug] ${event}`);
    return;
  }
  devLog(`[MapsApi][debug] ${event}`, payload);
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
  const res = await googleMapsWebServiceFetch(url, signal);
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

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleGeocodeResultItem = {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  address_components?: GoogleAddressComponent[];
};

type GoogleGeocodeFullResponse = {
  status: string;
  error_message?: string;
  results?: GoogleGeocodeResultItem[];
};

type GooglePlaceAutocompleteResponse = {
  status: string;
  error_message?: string;
  predictions?: Array<{
    description: string;
    place_id: string;
    structured_formatting?: {
      main_text: string;
      secondary_text?: string;
    };
  }>;
};

/** Human-readable primary label + optional city row from Google Geocoding. */
export function extractPlaceFieldsFromGeocodeResult(result: GoogleGeocodeResultItem): {
  placeName: string;
  city: string | null;
} {
  const comps = result.address_components ?? [];
  const pick = (...types: string[]) => {
    const c = comps.find((item) => item.types.some((t) => types.includes(t)));
    return c?.long_name?.trim() || null;
  };
  const establishment = pick("establishment", "point_of_interest");
  if (establishment) {
    const city =
      pick("locality") ??
      pick("postal_town") ??
      pick("administrative_area_level_2") ??
      pick("administrative_area_level_1");
    return { placeName: establishment, city };
  }
  const formatted = result.formatted_address?.trim() ?? "";
  const firstSegment = formatted.split(",")[0]?.trim() ?? "";
  const locality =
    pick("locality") ??
    pick("postal_town") ??
    pick("administrative_area_level_2") ??
    pick("administrative_area_level_1");
  return {
    placeName: firstSegment.length > 0 ? firstSegment : formatted || "Place",
    city: locality,
  };
}

export type GeocodeSearchResultItem = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeName: string;
  city: string | null;
};

const GEOCODE_SEARCH_MAX = 8;
const PLACE_AUTOCOMPLETE_MAX = 8;

function mapGeocodeResultToSearchItem(item: GoogleGeocodeResultItem): GeocodeSearchResultItem {
  const loc = item.geometry.location;
  const { placeName, city } = extractPlaceFieldsFromGeocodeResult(item);
  return {
    formattedAddress: item.formatted_address,
    latitude: loc.lat,
    longitude: loc.lng,
    placeName,
    city,
  };
}

/** Free-text suggestions via Geocoding API (multiple `results`). Enable Geocoding API for the key. */
export async function searchGeocodeAddresses(
  input: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<
  | { ok: true; results: GeocodeSearchResultItem[] }
  | { ok: false; status: string; message?: string }
> {
  const trimmed = input.trim();
  if (trimmed.length < 2) {
    return { ok: true, results: [] };
  }
  const q = new URLSearchParams({
    address: trimmed,
    key: apiKey,
  });
  const url = `${BASE}/geocode/json?${q.toString()}`;
  const res = await googleMapsWebServiceFetch(url, signal);
  const data = (await res.json()) as GoogleGeocodeFullResponse;
  debugMapsApi("geocode_search:response", {
    httpOk: res.ok,
    httpStatus: res.status,
    status: data.status,
    errorMessage: data.error_message,
    count: data.results?.length ?? 0,
  });
  if (data.status !== "OK" || !data.results?.length) {
    if (data.status === "ZERO_RESULTS") {
      return { ok: true, results: [] };
    }
    return {
      ok: false,
      status: data.status,
      message: data.error_message ?? data.status,
    };
  }
  const results: GeocodeSearchResultItem[] = data.results
    .slice(0, GEOCODE_SEARCH_MAX)
    .map((item) => mapGeocodeResultToSearchItem(item));
  return { ok: true, results };
}

export type AddressAutocompleteListItem = {
  placeId: string;
  placeName: string;
  formattedAddress: string;
};

/**
 * Partial-address suggestions via Places Autocomplete (legacy web service).
 * REQUIRES: Places API enabled for the key. After pick, resolve coordinates with {@link geocodePlaceIdToSearchItem} (Geocoding API).
 */
export async function searchAddressAutocomplete(
  input: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<
  | { ok: true; items: AddressAutocompleteListItem[] }
  | { ok: false; status: string; message?: string }
> {
  const trimmed = input.trim();
  if (trimmed.length < 2) {
    return { ok: true, items: [] };
  }
  const q = new URLSearchParams({
    input: trimmed,
    key: apiKey,
  });
  const url = `${BASE}/place/autocomplete/json?${q.toString()}`;
  const res = await googleMapsWebServiceFetch(url, signal);
  const data = (await res.json()) as GooglePlaceAutocompleteResponse;
  debugMapsApi("place_autocomplete:response", {
    httpOk: res.ok,
    httpStatus: res.status,
    status: data.status,
    errorMessage: data.error_message,
    count: data.predictions?.length ?? 0,
  });
  if (data.status !== "OK") {
    if (data.status === "ZERO_RESULTS") {
      return { ok: true, items: [] };
    }
    return {
      ok: false,
      status: data.status,
      message: data.error_message ?? data.status,
    };
  }
  const predictions = data.predictions ?? [];
  if (predictions.length === 0) {
    return { ok: true, items: [] };
  }
  const items: AddressAutocompleteListItem[] = predictions.slice(0, PLACE_AUTOCOMPLETE_MAX).map((p) => {
    const desc = p.description?.trim() ?? "";
    const main = p.structured_formatting?.main_text?.trim();
    return {
      placeId: p.place_id,
      placeName: main && main.length > 0 ? main : desc.split(",")[0]?.trim() || desc || "Place",
      formattedAddress: desc,
    };
  });
  return { ok: true, items };
}

/** Resolve a Places `place_id` to coordinates + formatted fields (Geocoding API). */
export async function geocodePlaceIdToSearchItem(
  placeId: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<
  | { ok: true; item: GeocodeSearchResultItem }
  | { ok: false; status: string; message?: string }
> {
  const q = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
  });
  const url = `${BASE}/geocode/json?${q.toString()}`;
  const res = await googleMapsWebServiceFetch(url, signal);
  const data = (await res.json()) as GoogleGeocodeFullResponse;
  debugMapsApi("geocode_place_id:response", {
    httpOk: res.ok,
    httpStatus: res.status,
    status: data.status,
    errorMessage: data.error_message,
    hasResult: Boolean(data.results?.[0]),
  });
  if (data.status !== "OK" || !data.results?.[0]) {
    if (data.status === "ZERO_RESULTS") {
      return { ok: false, status: "ZERO_RESULTS", message: "No coordinates for this place" };
    }
    return {
      ok: false,
      status: data.status,
      message: data.error_message ?? data.status,
    };
  }
  return { ok: true, item: mapGeocodeResultToSearchItem(data.results[0]) };
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
  const res = await googleMapsWebServiceFetch(url, signal);
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
      debugMapsApi("directions:polyline_decode_error", {
        error: e instanceof Error ? e.message : String(e),
        encodedLength: encoded.length,
      });
      coordinates = [];
    }
  } else {
    debugMapsApi("directions:no_polyline");
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
  debugMapsApi("directions:payload_summary", {
    mode,
    coordinatesCount: coordinates.length,
    hasLeg: Boolean(leg),
    hasStart: Boolean(startLocation),
    hasEnd: Boolean(endLocation),
    durationText,
    distanceText,
  });

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

const ROUTE_POLYLINE_MAX_POINTS = 320;

function isFiniteCoordinate(value: LatLng | null | undefined): value is LatLng {
  return Boolean(
    value &&
      Number.isFinite(value.latitude) &&
      Number.isFinite(value.longitude) &&
      Math.abs(value.latitude) <= 90 &&
      Math.abs(value.longitude) <= 180,
  );
}

function compactRouteCoordinates(coords: LatLng[]): LatLng[] {
  if (coords.length < 2) return [];
  const safe = coords.filter(isFiniteCoordinate);
  if (safe.length < 2) return [];

  const deduped: LatLng[] = [safe[0]];
  for (let i = 1; i < safe.length; i += 1) {
    const prev = deduped[deduped.length - 1];
    const cur = safe[i];
    if (Math.abs(prev.latitude - cur.latitude) < 1e-7 && Math.abs(prev.longitude - cur.longitude) < 1e-7) {
      continue;
    }
    deduped.push(cur);
  }
  if (deduped.length < 2) return [];

  if (deduped.length <= ROUTE_POLYLINE_MAX_POINTS) return deduped;
  const step = Math.ceil(deduped.length / ROUTE_POLYLINE_MAX_POINTS);
  const compact: LatLng[] = [];
  for (let i = 0; i < deduped.length; i += step) compact.push(deduped[i]);
  const last = deduped[deduped.length - 1];
  const tail = compact[compact.length - 1];
  if (!tail || tail.latitude !== last.latitude || tail.longitude !== last.longitude) compact.push(last);
  return compact;
}

function formatLatLng(coord: LatLng): string {
  return `${coord.latitude},${coord.longitude}`;
}

function formatDurationSeconds(totalSeconds: number): string | null {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${Math.max(1, minutes)} min`;
}

function formatDistanceMeters(totalMeters: number): string | null {
  if (!Number.isFinite(totalMeters) || totalMeters <= 0) return null;
  if (totalMeters >= 1000) return `${(totalMeters / 1000).toFixed(1)} km`;
  return `${Math.round(totalMeters)} m`;
}

export type MultiStopDirectionsResult = {
  coordinates: LatLng[];
  durationText: string | null;
  distanceText: string | null;
};

async function fetchRouteSegment(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
  apiKey: string,
  signal?: AbortSignal,
): Promise<
  | {
      ok: true;
      data: MultiStopDirectionsResult & { durationSeconds: number; distanceMeters: number };
    }
  | { ok: false; status: string; message?: string }
> {
  const q = new URLSearchParams({
    origin: formatLatLng(origin),
    destination: formatLatLng(destination),
    mode,
    key: apiKey,
  });
  const url = `${BASE}/directions/json?${q.toString()}`;
  const res = await googleMapsWebServiceFetch(url, signal);
  const data = (await res.json()) as GoogleDirectionsResponse;
  debugMapsApi("directions:segment_response", {
    httpOk: res.ok,
    httpStatus: res.status,
    status: data.status,
    errorMessage: data.error_message,
    mode,
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
  let coordinates: LatLng[] = [];
  if (encoded) {
    try {
      coordinates = decodeGooglePolyline(encoded);
    } catch (e) {
      debugMapsApi("directions:polyline_decode_error", {
        error: e instanceof Error ? e.message : String(e),
        encodedLength: encoded.length,
      });
    }
  }

  const leg = route.legs?.[0];
  const durationSeconds = leg?.duration?.value ?? 0;
  const distanceMeters = leg?.distance?.value ?? 0;
  return {
    ok: true,
    data: {
      coordinates: compactRouteCoordinates(coordinates),
      durationText: leg?.duration?.text ?? formatDurationSeconds(durationSeconds),
      distanceText: leg?.distance?.text ?? formatDistanceMeters(distanceMeters),
      durationSeconds,
      distanceMeters,
    },
  };
}

/**
 * Route through ordered stops (origin → waypoints → destination).
 * REQUIRES: Directions API enabled for the key.
 */
export async function fetchRouteBetweenStops(
  stops: LatLng[],
  apiKey: string,
  mode: TravelMode = "driving",
  signal?: AbortSignal,
): Promise<{ ok: true; data: MultiStopDirectionsResult } | { ok: false; status: string; message?: string }> {
  const validStops = stops.filter(isFiniteCoordinate);
  if (validStops.length < 2) {
    return { ok: false, status: "INVALID_REQUEST", message: "At least 2 stops required" };
  }

  const origin = validStops[0];
  const destination = validStops[validStops.length - 1];
  const middle = validStops.slice(1, -1);

  const q = new URLSearchParams({
    origin: formatLatLng(origin),
    destination: formatLatLng(destination),
    mode,
    key: apiKey,
  });
  if (middle.length > 0) {
    q.set("waypoints", middle.map(formatLatLng).join("|"));
  }

  const url = `${BASE}/directions/json?${q.toString()}`;
  const res = await googleMapsWebServiceFetch(url, signal);
  const data = (await res.json()) as GoogleDirectionsResponse;
  debugMapsApi("directions:multi_stop_response", {
    httpOk: res.ok,
    httpStatus: res.status,
    status: data.status,
    errorMessage: data.error_message,
    stopCount: validStops.length,
    mode,
    hasRoute: Boolean(data.routes?.[0]),
  });

  if (data.status === "OK" && data.routes?.[0]) {
    const route = data.routes[0];
    const encoded = route.overview_polyline?.points;
    let coordinates: LatLng[] = [];
    if (encoded) {
      try {
        coordinates = decodeGooglePolyline(encoded);
      } catch (e) {
        debugMapsApi("directions:polyline_decode_error", {
          error: e instanceof Error ? e.message : String(e),
          encodedLength: encoded.length,
        });
      }
    }

    const legs = route.legs ?? [];
    let totalDurationSec = 0;
    let totalDistanceM = 0;
    for (const leg of legs) {
      totalDurationSec += leg.duration?.value ?? 0;
      totalDistanceM += leg.distance?.value ?? 0;
    }

    const compact = compactRouteCoordinates(coordinates);
    if (compact.length >= 2) {
      return {
        ok: true,
        data: {
          coordinates: compact,
          durationText: formatDurationSeconds(totalDurationSec),
          distanceText: formatDistanceMeters(totalDistanceM),
        },
      };
    }
  }

  const merged: LatLng[] = [];
  let totalDurationSec = 0;
  let totalDistanceM = 0;
  for (let i = 0; i < validStops.length - 1; i += 1) {
    const segment = await fetchRouteSegment(validStops[i], validStops[i + 1], mode, apiKey, signal);
    if (!segment.ok) {
      return segment;
    }
    const segmentCoords = segment.data.coordinates;
    if (segmentCoords.length === 0) continue;
    if (merged.length === 0) {
      merged.push(...segmentCoords);
    } else {
      merged.push(...segmentCoords.slice(1));
    }
    totalDurationSec += segment.data.durationSeconds;
    totalDistanceM += segment.data.distanceMeters;
  }

  const compact = compactRouteCoordinates(merged);
  if (compact.length < 2) {
    return {
      ok: false,
      status: data.status ?? "ZERO_RESULTS",
      message: data.error_message ?? `No ${mode} route found`,
    };
  }

  return {
    ok: true,
    data: {
      coordinates: compact,
      durationText: formatDurationSeconds(totalDurationSec),
      distanceText: formatDistanceMeters(totalDistanceM),
    },
  };
}

/** @deprecated Use {@link fetchRouteBetweenStops} with `mode: "driving"`. */
export async function fetchDrivingRouteBetweenStops(
  stops: LatLng[],
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ ok: true; data: MultiStopDirectionsResult } | { ok: false; status: string; message?: string }> {
  return fetchRouteBetweenStops(stops, apiKey, "driving", signal);
}
