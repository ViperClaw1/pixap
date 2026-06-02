import { memo, useMemo, useRef } from "react";
import { Platform, StyleSheet } from "react-native";
import MapView, { Polyline, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { regionAroundPoint, regionFromCoordinates } from "@/shared/lib/mapRegion";
import { useFitMapToRoute } from "@/shared/lib/useFitMapToRoute";
import type { LatLng } from "@/shared/lib/polylineDecode";
import { RouteNumberMarker } from "./RouteNumberMarker";
import type { VibeRouteMapInteractiveProps } from "./types";

const DEFAULT_REGION: Region = {
  latitude: 43.238949,
  longitude: 76.945465,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

function VibeRouteMapInteractiveComponent({
  points,
  polylineCoords,
  travelMode,
  accentColor,
  labelColor,
  highlightedVenueId = null,
  onMarkerPress,
}: VibeRouteMapInteractiveProps) {
  const mapRef = useRef<MapView | null>(null);

  const fitCoords = useMemo((): LatLng[] => {
    if (polylineCoords.length >= 2) return polylineCoords;
    return points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
  }, [points, polylineCoords]);

  const fitRouteKey = useMemo(
    () =>
      `${travelMode}|${fitCoords.map((coord) => `${coord.latitude},${coord.longitude}`).join("|")}`,
    [fitCoords, travelMode],
  );

  const initialRegion = useMemo((): Region => {
    if (fitCoords.length >= 2) {
      return regionFromCoordinates(fitCoords) ?? regionAroundPoint(fitCoords[0]);
    }
    if (fitCoords.length === 1) {
      return regionAroundPoint(fitCoords[0], 0.035);
    }
    return DEFAULT_REGION;
  }, [fitCoords]);

  const polylineForRender = useMemo(
    () => (polylineCoords.length >= 2 ? polylineCoords : []),
    [polylineCoords],
  );

  const { onRegionChange } = useFitMapToRoute(mapRef, fitCoords, fitRouteKey);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFillObject}
      initialRegion={initialRegion}
      scrollEnabled
      zoomEnabled
      zoomTapEnabled
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      loadingEnabled={Platform.OS === "android"}
      onRegionChange={onRegionChange}
    >
      {polylineForRender.length >= 2 ? (
        <Polyline coordinates={polylineForRender} strokeColor={accentColor} strokeWidth={4} />
      ) : null}
      {points.map((point) => (
        <RouteNumberMarker
          key={point.venueId}
          venueId={point.venueId}
          order={point.order}
          latitude={point.latitude}
          longitude={point.longitude}
          accentColor={accentColor}
          labelColor={labelColor}
          highlighted={highlightedVenueId === point.venueId}
          onPress={onMarkerPress}
        />
      ))}
    </MapView>
  );
}

export const VibeRouteMapInteractive = memo(VibeRouteMapInteractiveComponent);
