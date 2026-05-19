import { devLog, devWarn } from "@/shared/lib/devLog";
import { haversineMeters, isValidLatLng } from "./geo";
import type { LatLng } from "../model/types";

const TAG = "[CrowdCheckin]";

export function logCrowdCheckin(event: string, payload?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (payload !== undefined) {
    devLog(TAG, event, payload);
    return;
  }
  devLog(TAG, event);
}

export function logCrowdCheckinWarn(event: string, payload?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (payload !== undefined) {
    devWarn(TAG, event, payload);
    return;
  }
  devWarn(TAG, event);
}

export type CrowdDistanceDebug = {
  distanceM: number | null;
  withinRadius: boolean | null;
  maxMeters: number;
  user: LatLng | null;
  venue: LatLng | null;
  venueCoordsSource: "business_card" | "missing" | "invalid";
};

export function buildCrowdDistanceDebug(
  user: LatLng | null,
  venue: LatLng | null | undefined,
  maxMeters: number,
): CrowdDistanceDebug {
  let venueCoordsSource: CrowdDistanceDebug["venueCoordsSource"] = "missing";
  let normalizedVenue: LatLng | null = null;

  if (venue != null) {
    if (isValidLatLng(venue)) {
      venueCoordsSource = "business_card";
      normalizedVenue = venue;
    } else {
      venueCoordsSource = "invalid";
    }
  }

  if (!user || !normalizedVenue) {
    return {
      distanceM: null,
      withinRadius: null,
      maxMeters,
      user,
      venue: normalizedVenue,
      venueCoordsSource,
    };
  }

  const distanceM = haversineMeters(user, normalizedVenue);
  return {
    distanceM: Math.round(distanceM * 10) / 10,
    withinRadius: distanceM <= maxMeters,
    maxMeters,
    user,
    venue: normalizedVenue,
    venueCoordsSource,
  };
}

export function logCrowdDistance(
  step: string,
  user: LatLng | null,
  venue: LatLng | null | undefined,
  maxMeters: number,
  extra?: Record<string, unknown>,
): CrowdDistanceDebug {
  const debug = buildCrowdDistanceDebug(user, venue, maxMeters);
  logCrowdCheckin(`distance:${step}`, {
    ...debug,
    ...extra,
  });
  return debug;
}
