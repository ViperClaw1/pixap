import { useCallback, useEffect, useMemo, useState } from "react";
import type { VibePlanStop } from "@/entities/pixai";

const ROUTE_REBUILD_DEBOUNCE_MS = 2500;

function routeKeyFromVenueIds(plan: VibePlanStop[], venueIds: string[]): string {
  const idSet = new Set(venueIds);
  return plan.filter((stop) => idSet.has(stop.venue_id)).map((stop) => stop.venue_id).join("|");
}

function planStopsForRouteKey(plan: VibePlanStop[], routeKey: string): VibePlanStop[] {
  const ids = new Set(routeKey.split("|").filter(Boolean));
  return plan.filter((stop) => ids.has(stop.venue_id));
}

export function useDebouncedVibeRouteSelection(plan: VibePlanStop[], selectedVenueIds: string[]) {
  const isSingleStopRoute = plan.length === 1;
  const selectedRouteKey = useMemo(
    () => routeKeyFromVenueIds(plan, selectedVenueIds),
    [plan, selectedVenueIds],
  );
  const [committedRouteKey, setCommittedRouteKey] = useState(selectedRouteKey);
  const [isRebuildPending, setIsRebuildPending] = useState(false);

  useEffect(() => {
    if (isSingleStopRoute) {
      setCommittedRouteKey(selectedRouteKey);
      setIsRebuildPending(false);
    }
  }, [isSingleStopRoute, selectedRouteKey]);

  useEffect(() => {
    if (isSingleStopRoute) return;
    if (selectedRouteKey === committedRouteKey) {
      setIsRebuildPending(false);
      return;
    }
    setIsRebuildPending(true);
    const timer = setTimeout(() => {
      setCommittedRouteKey(selectedRouteKey);
      setIsRebuildPending(false);
    }, ROUTE_REBUILD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [committedRouteKey, isSingleStopRoute, selectedRouteKey]);

  const routePlanStops = useMemo(() => {
    if (isSingleStopRoute) return plan;
    return planStopsForRouteKey(plan, committedRouteKey);
  }, [committedRouteKey, isSingleStopRoute, plan]);

  const syncRouteSelectionNow = useCallback(
    (venueIds: string[]) => {
      const key = routeKeyFromVenueIds(plan, venueIds);
      setCommittedRouteKey(key);
      setIsRebuildPending(false);
    },
    [plan],
  );

  const resetRouteSelection = useCallback(() => {
    setCommittedRouteKey("");
    setIsRebuildPending(false);
  }, []);

  return {
    routePlanStops,
    isRebuildPending,
    syncRouteSelectionNow,
    resetRouteSelection,
  };
}
