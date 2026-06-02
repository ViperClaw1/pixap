import { Platform } from "react-native";
import * as Location from "expo-location";
import type { LatLng } from "../model/types";
import { logCrowdCheckin, logCrowdCheckinWarn } from "./crowdCheckinDebug";
import { isValidLatLng } from "./geo";

export type ForegroundLocationResult =
  | { ok: true; coords: LatLng }
  | { ok: false; reason: "denied" | "unavailable" | "invalid" };

export type RequestForegroundLocationOptions = {
  /** Android: use recent cached fix before GPS (manual check-in). */
  preferCachedOnAndroid?: boolean;
};

const ANDROID_GPS_TIMEOUT_MS = 12_000;
const LAST_KNOWN_MAX_AGE_MS = 120_000;

function coordsFromPosition(position: Location.LocationObject): LatLng {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

function isFreshPosition(position: Location.LocationObject, maxAgeMs: number): boolean {
  const ts = position.timestamp;
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= maxAgeMs;
}

function positionToResult(position: Location.LocationObject, source: string): ForegroundLocationResult {
  const coords = coordsFromPosition(position);
  logCrowdCheckin(`location:${source}`, {
    coords,
    accuracyM: position.coords.accuracy ?? null,
    altitudeM: position.coords.altitude ?? null,
    timestamp: position.timestamp,
  });
  if (!isValidLatLng(coords)) {
    logCrowdCheckinWarn("location:invalid_coords", { coords });
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, coords };
}

async function getCurrentPositionWithTimeout(
  timeoutMs: number,
  accuracy: Location.Accuracy,
): Promise<Location.LocationObject> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Location request timed out"));
    }, timeoutMs);

    void Location.getCurrentPositionAsync({ accuracy })
      .then((position) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(position);
      })
      .catch((error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
}

export async function requestForegroundLocation(
  options?: RequestForegroundLocationOptions,
): Promise<ForegroundLocationResult> {
  const existing = await Location.getForegroundPermissionsAsync();
  let status = existing.status;

  if (status !== "granted") {
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
  }

  if (status !== "granted") {
    logCrowdCheckinWarn("location:permission_denied", { status });
    return { ok: false, reason: "denied" };
  }

  const useAndroidFastPath = Platform.OS === "android" && options?.preferCachedOnAndroid;

  if (useAndroidFastPath) {
    try {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown && isFreshPosition(lastKnown, LAST_KNOWN_MAX_AGE_MS)) {
        const cached = positionToResult(lastKnown, "last_known");
        if (cached.ok) return cached;
      }
    } catch (error) {
      logCrowdCheckinWarn("location:last_known_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const position = await getCurrentPositionWithTimeout(
        ANDROID_GPS_TIMEOUT_MS,
        Location.Accuracy.Balanced,
      );
      return positionToResult(position, "received_android");
    } catch (error) {
      logCrowdCheckinWarn("location:unavailable", {
        message: error instanceof Error ? error.message : String(error),
      });
      return { ok: false, reason: "unavailable" };
    }
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return positionToResult(position, "received");
  } catch (error) {
    logCrowdCheckinWarn("location:unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: "unavailable" };
  }
}
