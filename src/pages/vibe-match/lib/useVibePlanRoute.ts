import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRouteBetweenStops, type TravelMode } from "@/shared/lib/directionsApi";
import { env } from "@/shared/lib/env";
import type { LatLng } from "@/shared/lib/polylineDecode";
import { queryKeys } from "@/shared/api/queryKeys";
import type { VibeRouteMapPoint } from "./useVibePlanMapPoints";

function buildStraightLineCoords(points: VibeRouteMapPoint[]): LatLng[] {
  return points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
}

export function useVibePlanRoute(points: VibeRouteMapPoint[], travelMode: TravelMode) {
  const apiKey = env.googleMapsWebApiKey;
  const coordsKey = points.map((point) => `${point.latitude},${point.longitude}`).join("|");
  const fallbackPolyline = useMemo(() => buildStraightLineCoords(points), [points]);

  const routeQuery = useQuery({
    queryKey: queryKeys.vibeMatch.route(travelMode, coordsKey),
    queryFn: async ({ signal }) => {
      if (!apiKey) throw new Error("Missing Google Maps API key");
      const stops = points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
      const result = await fetchRouteBetweenStops(stops, apiKey, travelMode, signal);
      if (!result.ok) throw new Error(result.message ?? result.status);
      return result.data;
    },
    enabled: points.length >= 2 && Boolean(apiKey),
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const polylineCoords = useMemo(() => {
    const routeCoords = routeQuery.data?.coordinates ?? [];
    if (routeCoords.length >= 2) return routeCoords;
    return fallbackPolyline;
  }, [fallbackPolyline, routeQuery.data?.coordinates]);

  const usesStraightFallback =
    points.length >= 2 &&
    (routeQuery.isError || !apiKey || (routeQuery.isSuccess && (routeQuery.data?.coordinates.length ?? 0) < 2));

  return {
    polylineCoords,
    durationText: routeQuery.data?.durationText ?? null,
    distanceText: routeQuery.data?.distanceText ?? null,
    isLoadingDirections: points.length >= 2 && Boolean(apiKey) && routeQuery.isPending,
    usesStraightFallback,
  };
}

/** @deprecated Use {@link useVibePlanRoute}. */
export function useVibePlanDrivingRoute(points: VibeRouteMapPoint[]) {
  return useVibePlanRoute(points, "driving");
}
