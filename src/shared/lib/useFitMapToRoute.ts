import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type MapView from "react-native-maps";
import { regionAroundPoint } from "@/shared/lib/mapRegion";
import type { LatLng } from "@/shared/lib/polylineDecode";

export const ROUTE_MAP_EDGE_PADDING = { top: 48, right: 36, bottom: 52, left: 36 } as const;

type EdgePadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/**
 * Fits the map camera to route coordinates when the route key changes.
 * Skips auto-fit after the user pans/zooms until the route key resets.
 */
export function useFitMapToRoute(
  mapRef: RefObject<MapView | null>,
  fitCoords: LatLng[],
  fitRouteKey: string,
  edgePadding: EdgePadding = ROUTE_MAP_EDGE_PADDING,
) {
  const userAdjustedRef = useRef(false);

  const fitMapToRoute = useCallback(() => {
    if (fitCoords.length === 0) return;
    requestAnimationFrame(() => {
      const map = mapRef.current;
      if (!map) return;
      if (fitCoords.length === 1) {
        void map.animateToRegion(regionAroundPoint(fitCoords[0], 0.035), 320);
        return;
      }
      void map.fitToCoordinates(fitCoords, {
        edgePadding,
        animated: true,
      });
    });
  }, [edgePadding, fitCoords, mapRef]);

  useEffect(() => {
    userAdjustedRef.current = false;
  }, [fitRouteKey]);

  useEffect(() => {
    if (userAdjustedRef.current) return;
    fitMapToRoute();
  }, [fitMapToRoute, fitRouteKey]);

  const onRegionChange = useCallback(() => {
    userAdjustedRef.current = true;
  }, []);

  return { onRegionChange, fitMapToRoute };
}
