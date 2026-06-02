import { useCallback, useEffect, useRef, useState } from "react";
import { useRecordVenueCheckin } from "@/entities/venue-crowd/api/useRecordVenueCheckin";
import {
  buildCrowdDistanceDebug,
  logCrowdCheckin,
  logCrowdDistance,
} from "@/entities/venue-crowd/lib/crowdCheckinDebug";
import { isValidLatLng, isWithinRadiusMeters } from "@/entities/venue-crowd/lib/geo";
import { requestForegroundLocation } from "@/entities/venue-crowd/lib/requestForegroundLocation";

const CLIENT_PROXIMITY_MAX_M = 100;
const AUTO_CHECKIN_COOLDOWN_MS = 15 * 60 * 1000;

export type CrowdCheckinOutcome =
  | "recorded"
  | "rate_limited"
  | "location_denied"
  | "too_far"
  | "error"
  | "skipped";

type Options = {
  venueId: string;
  venueLatitude: number | null | undefined;
  venueLongitude: number | null | undefined;
  isAuthenticated: boolean;
  autoOnMount?: boolean;
};

export function usePlaceCrowdCheckin({
  venueId,
  venueLatitude,
  venueLongitude,
  isAuthenticated,
  autoOnMount = true,
}: Options) {
  const recordMutation = useRecordVenueCheckin(venueId);
  const lastAutoAttemptRef = useRef<number>(0);
  const autoAttemptedRef = useRef(false);
  const manualCheckInBusyRef = useRef(false);
  const [manualCheckInBusy, setManualCheckInBusy] = useState(false);

  useEffect(() => {
    autoAttemptedRef.current = false;
  }, [venueId]);

  useEffect(() => {
    logCrowdCheckin("venue:coords_from_business_card", {
      venueId,
      latitude: venueLatitude ?? null,
      longitude: venueLongitude ?? null,
      hasValidCoords:
        venueLatitude != null &&
        venueLongitude != null &&
        isValidLatLng({ latitude: venueLatitude, longitude: venueLongitude }),
    });
  }, [venueId, venueLatitude, venueLongitude]);

  const tryCheckin = useCallback(
    async (options?: { manual?: boolean }): Promise<CrowdCheckinOutcome> => {
      const mode = options?.manual ? "manual" : "auto";

      if (!isAuthenticated || !venueId) {
        logCrowdCheckin(`checkin:${mode}:skipped`, { reason: "not_authenticated_or_no_venue" });
        return "skipped";
      }

      logCrowdCheckin(`checkin:${mode}:start`, {
        venueId,
        venueLatitude: venueLatitude ?? null,
        venueLongitude: venueLongitude ?? null,
      });

      const location = await requestForegroundLocation({
        preferCachedOnAndroid: options?.manual === true,
      });
      if (!location.ok) {
        logCrowdCheckin(`checkin:${mode}:location_failed`, { reason: location.reason });
        return location.reason === "denied" ? "location_denied" : "error";
      }

      const venueCoords =
        venueLatitude != null && venueLongitude != null
          ? { latitude: venueLatitude, longitude: venueLongitude }
          : null;

      const clientDistance = logCrowdDistance(
        `client_pre_rpc_${mode}`,
        location.coords,
        venueCoords,
        CLIENT_PROXIMITY_MAX_M,
        { venueId },
      );

      if (
        venueCoords &&
        isValidLatLng(venueCoords) &&
        !isWithinRadiusMeters(location.coords, venueCoords, CLIENT_PROXIMITY_MAX_M)
      ) {
        logCrowdCheckin(`checkin:${mode}:blocked_on_client`, {
          source: "client_haversine",
          ...buildCrowdDistanceDebug(location.coords, venueCoords, CLIENT_PROXIMITY_MAX_M),
        });
        return options?.manual ? "too_far" : "skipped";
      }

      if (!venueCoords || !isValidLatLng(venueCoords)) {
        logCrowdCheckin(`checkin:${mode}:client_precheck_skipped`, {
          reason: "venue_lat_lng_missing_or_invalid",
          note: "RPC will validate against business_cards.location on server",
        });
      }

      try {
        const result = await recordMutation.mutateAsync(location.coords);
        if (result.recorded) {
          logCrowdCheckin(`checkin:${mode}:success`, { clientDistance });
          return "recorded";
        }
        if (result.reason === "rate_limited") {
          logCrowdCheckin(`checkin:${mode}:rate_limited`, { clientDistance });
          return "rate_limited";
        }
        if (result.reason === "too_far") {
          logCrowdCheckin(`checkin:${mode}:blocked_on_server`, {
            source: "rpc_st_dwithin",
            serverDistanceM: result.distance_m ?? null,
            clientDistance,
            userCoords: location.coords,
            venueCoords,
          });
          return "too_far";
        }
        logCrowdCheckin(`checkin:${mode}:rpc_rejected`, {
          reason: result.reason ?? "unknown",
          serverDistanceM: result.distance_m ?? null,
          clientDistance,
        });
        return options?.manual ? "error" : "skipped";
      } catch (error) {
        const rpcMessage =
          error && typeof error === "object" && "message" in error
            ? String((error as { message: unknown }).message)
            : String(error);
        logCrowdCheckin(`checkin:${mode}:rpc_error`, {
          message: rpcMessage,
          clientDistance,
        });
        return options?.manual ? "error" : "skipped";
      }
    },
    [isAuthenticated, venueId, venueLatitude, venueLongitude, recordMutation],
  );

  const checkInManual = useCallback(async () => {
    if (manualCheckInBusyRef.current || recordMutation.isPending) {
      return "skipped" as const;
    }
    manualCheckInBusyRef.current = true;
    setManualCheckInBusy(true);
    try {
      return await tryCheckin({ manual: true });
    } finally {
      manualCheckInBusyRef.current = false;
      setManualCheckInBusy(false);
    }
  }, [recordMutation.isPending, tryCheckin]);

  useEffect(() => {
    if (!autoOnMount || !isAuthenticated || !venueId || autoAttemptedRef.current) return;

    const now = Date.now();
    if (now - lastAutoAttemptRef.current < AUTO_CHECKIN_COOLDOWN_MS) return;

    autoAttemptedRef.current = true;
    lastAutoAttemptRef.current = now;

    void tryCheckin();
  }, [autoOnMount, isAuthenticated, venueId, tryCheckin]);

  return {
    checkInManual,
    isCheckingIn: manualCheckInBusy || recordMutation.isPending,
  };
}
