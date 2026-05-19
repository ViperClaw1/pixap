import * as Location from "expo-location";
import type { LatLng } from "../model/types";
import { logCrowdCheckin, logCrowdCheckinWarn } from "./crowdCheckinDebug";
import { isValidLatLng } from "./geo";

export type ForegroundLocationResult =
  | { ok: true; coords: LatLng }
  | { ok: false; reason: "denied" | "unavailable" | "invalid" };

export async function requestForegroundLocation(): Promise<ForegroundLocationResult> {
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

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coords: LatLng = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    logCrowdCheckin("location:received", {
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
  } catch (error) {
    logCrowdCheckinWarn("location:unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: "unavailable" };
  }
}
