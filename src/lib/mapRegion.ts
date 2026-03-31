import type { LatLng } from "./polylineDecode";

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const MIN_DELTA = 0.006; // ~650m span — keeps short trips readable
const MAX_DELTA = 8;
const PAD = 1.45;

function isValidCoord(c: LatLng): boolean {
  return (
    Number.isFinite(c.latitude) &&
    Number.isFinite(c.longitude) &&
    Math.abs(c.latitude) <= 90 &&
    Math.abs(c.longitude) <= 180
  );
}

/**
 * Compute a map region that contains all coordinates, with padding.
 * Prefer this over relying on `fitToCoordinates` alone inside modals (layout timing).
 */
export function regionFromCoordinates(coords: LatLng[]): MapRegion | null {
  const valid = coords.filter(isValidCoord);
  if (valid.length === 0) return null;

  let minLat = valid[0].latitude;
  let maxLat = valid[0].latitude;
  let minLng = valid[0].longitude;
  let maxLng = valid[0].longitude;

  for (let i = 1; i < valid.length; i++) {
    const c = valid[i];
    minLat = Math.min(minLat, c.latitude);
    maxLat = Math.max(maxLat, c.latitude);
    minLng = Math.min(minLng, c.longitude);
    maxLng = Math.max(maxLng, c.longitude);
  }

  const lat = (minLat + maxLat) / 2;
  const lng = (minLng + maxLng) / 2;

  let latDelta = (maxLat - minLat) * PAD || MIN_DELTA;
  let lngDelta = (maxLng - minLng) * PAD || MIN_DELTA;

  latDelta = Math.max(MIN_DELTA, Math.min(latDelta, MAX_DELTA));
  lngDelta = Math.max(MIN_DELTA, Math.min(lngDelta, MAX_DELTA));

  // Avoid ultra-thin regions (N–S vs E–W) so zoom feels natural
  const ratio = 0.55;
  if (lngDelta < latDelta * ratio) {
    lngDelta = latDelta * ratio;
  }
  if (latDelta < lngDelta * ratio) {
    latDelta = lngDelta * ratio;
  }

  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

/** Tight region around a single point (destination while route loads). */
export function regionAroundPoint(point: LatLng, delta = 0.04): MapRegion {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}
