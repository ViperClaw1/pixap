import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRouteBetweenStops, type TravelMode } from "@/shared/lib/directionsApi";
import { env } from "@/shared/lib/env";
import type { LatLng } from "@/shared/lib/polylineDecode";
import { queryKeys } from "@/shared/api/queryKeys";
import { supabase } from "@/shared/api/supabase/client";
import { isInsufficientBookingCreditsError } from "@/entities/booking-credits";
import { devWarn } from "@/shared/lib/devLog";
import type { VibeRouteMapPoint } from "./useVibePlanMapPoints";

function buildStraightLineCoords(points: VibeRouteMapPoint[]): LatLng[] {
  return points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
}

export function useVibePlanRoute(points: VibeRouteMapPoint[], travelMode: TravelMode) {
  const apiKey = env.googleMapsWebApiKey;
  const coordsKey = points.map((point) => `${point.latitude},${point.longitude}`).join("|");
  const fallbackPolyline = useMemo(() => buildStraightLineCoords(points), [points]);
  const queryClient = useQueryClient();

  const routeQuery = useQuery({
    queryKey: queryKeys.vibeMatch.route(travelMode, coordsKey),
    queryFn: async ({ signal }) => {
      if (!apiKey) throw new Error("Missing Google Maps API key");
      const stops = points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
      const result = await fetchRouteBetweenStops(stops, apiKey, travelMode, signal);
      if (!result.ok) throw new Error(result.message ?? result.status);

      // Route successfully built via Google Maps — charge the route-build credit for it.
      // Never block/undo the already-fetched route on insufficient credits; just surface it.
      let insufficientCredits = false;
      const { error: creditError } = await supabase.rpc("consume_route_build_credit", {
        p_stop_count: stops.length,
      });
      if (creditError) {
        insufficientCredits = isInsufficientBookingCreditsError(creditError);
        if (!insufficientCredits && __DEV__) {
          devWarn("[useVibePlanRoute] route credit deduction failed", creditError.message);
        }
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookingCredits.prefix });

      return { ...result.data, insufficientCredits };
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
    insufficientRouteCredits: routeQuery.data?.insufficientCredits ?? false,
  };
}

/** @deprecated Use {@link useVibePlanRoute}. */
export function useVibePlanDrivingRoute(points: VibeRouteMapPoint[]) {
  return useVibePlanRoute(points, "driving");
}
