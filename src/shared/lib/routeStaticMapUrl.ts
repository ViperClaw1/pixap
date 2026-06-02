import { devLog } from "@/shared/lib/devLog";
import { googleMapsWebServiceFetch } from "./directionsApi";
import { encodeGooglePolyline, type LatLng } from "./polylineDecode";

const STATIC_MAP_MAX_PX = 640;

export type RouteStaticMapMarker = {
  latitude: number;
  longitude: number;
  label?: string | number;
};

function isFiniteCoordinate(value: LatLng | null | undefined): value is LatLng {
  return Boolean(
    value &&
      Number.isFinite(value.latitude) &&
      Number.isFinite(value.longitude) &&
      Math.abs(value.latitude) <= 90 &&
      Math.abs(value.longitude) <= 180,
  );
}

function toStaticMapColor(color: string): string {
  const cleaned = color.replace(/^#/, "").trim();
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `0x${cleaned}`;
  }
  return "0x000000";
}

function formatLatLng(coord: LatLng): string {
  return `${coord.latitude},${coord.longitude}`;
}

/**
 * Builds a Google Static Maps image URL (REST only — no native Maps SDK).
 * REQUIRES: Maps Static API enabled for the key.
 */
export function buildRouteStaticMapUrl(params: {
  width: number;
  height: number;
  scale?: 1 | 2;
  apiKey: string;
  polylineCoords: LatLng[];
  points: RouteStaticMapMarker[];
  pathColor: string;
}): string | null {
  const apiKey = params.apiKey.trim();
  if (!apiKey) return null;

  const scale = params.scale ?? 2;
  const width = Math.max(1, Math.min(STATIC_MAP_MAX_PX, Math.round(params.width)));
  const height = Math.max(1, Math.min(STATIC_MAP_MAX_PX, Math.round(params.height)));
  const pathColor = toStaticMapColor(params.pathColor);

  const markers = params.points.filter(isFiniteCoordinate);
  const polyline = params.polylineCoords.filter(isFiniteCoordinate);
  const visibleCoords = polyline.length >= 2 ? polyline : markers;
  if (visibleCoords.length === 0) return null;

  const query = new URLSearchParams();
  query.set("size", `${width}x${height}`);
  if (scale !== 1) {
    query.set("scale", String(scale));
  }
  query.set("maptype", "roadmap");
  query.set("visible", visibleCoords.map(formatLatLng).join("|"));

  if (polyline.length >= 2) {
    query.set("path", `weight:4|color:${pathColor}|enc:${encodeGooglePolyline(polyline)}`);
  }

  for (const marker of markers) {
    const label =
      marker.label != null ? String(marker.label).trim().slice(0, 1).toUpperCase() : undefined;
    const markerSpec = label
      ? `label:${label}|color:${pathColor}|${formatLatLng(marker)}`
      : `color:${pathColor}|${formatLatLng(marker)}`;
    query.append("markers", markerSpec);
  }

  query.set("key", apiKey);
  return `https://maps.googleapis.com/maps/api/staticmap?${query.toString()}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return globalThis.btoa(binary);
}

export type FetchRouteStaticMapImageResult =
  | { ok: true; dataUri: string }
  | { ok: false; httpStatus: number; message: string };

/** Loads Static Maps via fetch (supports Android/iOS key-restriction headers). */
export async function fetchRouteStaticMapImage(
  url: string,
  signal?: AbortSignal,
): Promise<FetchRouteStaticMapImageResult> {
  const res = await googleMapsWebServiceFetch(url, signal);
  const contentType = res.headers.get("content-type") ?? "";

  if (!res.ok || !contentType.includes("image")) {
    const message = (await res.text()).trim().slice(0, 400) || `HTTP ${res.status}`;
    if (__DEV__) {
      devLog("[StaticMap] load failed", { httpStatus: res.status, contentType, message });
    }
    return { ok: false, httpStatus: res.status, message };
  }

  const buffer = await res.arrayBuffer();
  const mime = contentType.split(";")[0]?.trim() || "image/png";
  const dataUri = `data:${mime};base64,${bytesToBase64(new Uint8Array(buffer))}`;
  return { ok: true, dataUri };
}
