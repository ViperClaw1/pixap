import { useEffect, useState } from "react";

type Params = {
  planSelectionKey: string;
  routePlanStopsCount: number;
  routeMapLoading: boolean;
  routeMapPointsCount: number;
  routeDirectionsLoading: boolean;
};

export function useInitialVibeRouteMapReady({
  planSelectionKey,
  routePlanStopsCount,
  routeMapLoading,
  routeMapPointsCount,
  routeDirectionsLoading,
}: Params) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
  }, [planSelectionKey]);

  useEffect(() => {
    if (ready || routePlanStopsCount === 0) return;

    const coordsReady = !routeMapLoading;
    const directionsReady = routeMapPointsCount < 2 || !routeDirectionsLoading;

    if (coordsReady && directionsReady) {
      setReady(true);
    }
  }, [ready, routeDirectionsLoading, routeMapLoading, routeMapPointsCount, routePlanStopsCount]);

  return ready;
}
