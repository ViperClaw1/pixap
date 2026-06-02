import { useMemo } from "react";
import { PixelRatio } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import { buildRouteStaticMapUrl, fetchRouteStaticMapImage } from "@/shared/lib/routeStaticMapUrl";
import type { LatLng } from "@/shared/lib/polylineDecode";
import type { VibeRouteMapPoint } from "./useVibePlanMapPoints";

const MAP_HEIGHT = 200;

type Params = {
  apiKey?: string;
  mapWidth: number;
  cacheKey: string;
  polylineCoords: LatLng[];
  points: VibeRouteMapPoint[];
  pathColor: string;
};

export function useVibeRouteStaticMap({
  apiKey,
  mapWidth,
  cacheKey,
  polylineCoords,
  points,
  pathColor,
}: Params) {
  const staticMapUrl = useMemo(() => {
    if (!apiKey || mapWidth <= 0 || points.length === 0) return null;
    return buildRouteStaticMapUrl({
      width: mapWidth,
      height: MAP_HEIGHT,
      scale: PixelRatio.get() >= 2 ? 2 : 1,
      apiKey,
      polylineCoords,
      points: points.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
        label: point.order,
      })),
      pathColor,
    });
  }, [apiKey, mapWidth, pathColor, points, polylineCoords]);

  return useQuery({
    queryKey: queryKeys.vibeMatch.staticMap(cacheKey, mapWidth),
    queryFn: async ({ signal }) => {
      if (!staticMapUrl) throw new Error("static_map_url_missing");
      const result = await fetchRouteStaticMapImage(staticMapUrl, signal);
      if (!result.ok) {
        throw new Error(result.message || `static_map_http_${result.httpStatus}`);
      }
      return result.dataUri;
    },
    enabled: Boolean(staticMapUrl),
    staleTime: 10 * 60_000,
    retry: 1,
  });
}
