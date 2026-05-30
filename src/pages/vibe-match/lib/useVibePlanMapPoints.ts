import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { VibePlanStop } from "@/entities/pixai";
import { queryKeys } from "@/shared/api/queryKeys";
import {
  fetchVibePlanCoordinates,
  isValidMapCoordinate,
  type VibePlanCoordinate,
} from "../api/fetchVibePlanCoordinates";

export type VibeRouteMapPoint = {
  venueId: string;
  order: number;
  latitude: number;
  longitude: number;
};

function stopCoordinate(stop: VibePlanStop): { latitude: number; longitude: number } | null {
  const latitude = stop.latitude;
  const longitude = stop.longitude;
  if (latitude == null || longitude == null) return null;
  if (!isValidMapCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

function buildPoints(
  plan: VibePlanStop[],
  fetched: VibePlanCoordinate[],
): { points: VibeRouteMapPoint[]; missingCount: number } {
  const coordByVenueId = new Map<string, { latitude: number; longitude: number }>();

  for (const row of fetched) {
    coordByVenueId.set(row.venueId, { latitude: row.latitude, longitude: row.longitude });
  }
  for (const stop of plan) {
    const fromStop = stopCoordinate(stop);
    if (fromStop) coordByVenueId.set(stop.venue_id, fromStop);
  }

  const points: VibeRouteMapPoint[] = [];
  for (let i = 0; i < plan.length; i += 1) {
    const stop = plan[i];
    const coord = coordByVenueId.get(stop.venue_id);
    if (!coord) continue;
    points.push({
      venueId: stop.venue_id,
      order: i + 1,
      latitude: coord.latitude,
      longitude: coord.longitude,
    });
  }

  return { points, missingCount: Math.max(0, plan.length - points.length) };
}

export function useVibePlanMapPoints(plan: VibePlanStop[]) {
  const venueIdsNeedingFetch = useMemo(
    () => plan.filter((stop) => !stopCoordinate(stop)).map((stop) => stop.venue_id),
    [plan],
  );
  const fetchKey = venueIdsNeedingFetch.join("|");

  const coordinatesQuery = useQuery({
    queryKey: queryKeys.vibeMatch.planCoordinates(fetchKey),
    queryFn: () => fetchVibePlanCoordinates(venueIdsNeedingFetch),
    enabled: venueIdsNeedingFetch.length > 0,
    staleTime: 5 * 60_000,
  });

  const { points, missingCount } = useMemo(
    () => buildPoints(plan, coordinatesQuery.data ?? []),
    [coordinatesQuery.data, plan],
  );

  const isLoading =
    plan.length > 0 &&
    points.length === 0 &&
    venueIdsNeedingFetch.length > 0 &&
    coordinatesQuery.isPending;

  return {
    points,
    missingCount,
    isLoading,
    isError: coordinatesQuery.isError,
  };
}
