import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { logCrowdCheckin, logCrowdCheckinWarn } from "../lib/crowdCheckinDebug";
import type { LatLng, RecordVenueCheckinResult } from "../model/types";

function parseCheckinResult(data: unknown): RecordVenueCheckinResult {
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const recorded = row.recorded === true;
  const reason = typeof row.reason === "string" ? row.reason : undefined;
  const distanceRaw = row.distance_m;
  const distance_m =
    typeof distanceRaw === "number" && Number.isFinite(distanceRaw) ? distanceRaw : undefined;
  return { recorded, reason, distance_m };
}

export async function recordVenueCrowdCheckin(
  venueId: string,
  coords: LatLng,
): Promise<RecordVenueCheckinResult> {
  logCrowdCheckin("rpc:record_venue_crowd_checkin:request", {
    venueId,
    userCoords: coords,
  });

  const { data, error } = await supabase.rpc("record_venue_crowd_checkin", {
    p_venue_id: venueId,
    p_latitude: coords.latitude,
    p_longitude: coords.longitude,
  });

  if (error) {
    logCrowdCheckinWarn("rpc:record_venue_crowd_checkin:error", {
      venueId,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  const result = parseCheckinResult(data);
  logCrowdCheckin("rpc:record_venue_crowd_checkin:response", {
    venueId,
    raw: data,
    parsed: result,
  });
  return result;
}

export function useRecordVenueCheckin(venueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (coords: LatLng) => recordVenueCrowdCheckin(venueId, coords),
    onSuccess: (result) => {
      if (result.recorded) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.venueCrowd.byVenue(venueId) });
      }
    },
  });
}
