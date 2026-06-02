import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import type { TravelMode } from "@/shared/lib/directionsApi";
import { regionAroundPoint, regionFromCoordinates } from "@/shared/lib/mapRegion";
import type { LatLng } from "@/shared/lib/polylineDecode";
import type { VibeRouteMapPoint } from "../lib/useVibePlanMapPoints";

const MAP_EDGE_PADDING = { top: 48, right: 36, bottom: 52, left: 36 };

type NumberedMarkerProps = {
  order: number;
  latitude: number;
  longitude: number;
  accentColor: string;
  labelColor: string;
};

const RouteNumberMarker = memo(function RouteNumberMarker({
  order,
  latitude,
  longitude,
  accentColor,
  labelColor,
}: NumberedMarkerProps) {
  const coordinate = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);
  const [tracksViewChanges, setTracksViewChanges] = useState(Platform.OS === "android");

  useEffect(() => {
    if (Platform.OS !== "android") return;
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), 120);
    return () => clearTimeout(timer);
  }, [order, accentColor, labelColor]);

  return (
    <Marker
      coordinate={coordinate}
      tracksViewChanges={Platform.OS === "android" ? tracksViewChanges : false}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View
        collapsable={false}
        style={[markerStyles.bubble, { backgroundColor: accentColor, borderColor: accentColor }]}
      >
        <Text style={[markerStyles.label, { color: labelColor }]}>{order}</Text>
      </View>
    </Marker>
  );
});

type Props = {
  points: VibeRouteMapPoint[];
  polylineCoords: LatLng[];
  travelMode: TravelMode;
  accentColor: string;
  labelColor: string;
};

export function VibeRouteMapNative({ points, polylineCoords, travelMode, accentColor, labelColor }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const userAdjustedMapRef = useRef(false);
  const mapProvider = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

  const fitCoords = useMemo(() => {
    if (polylineCoords.length >= 2) return polylineCoords;
    return points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
  }, [points, polylineCoords]);

  const fitRouteKey = useMemo(
    () => `${travelMode}|${fitCoords.map((coord) => `${coord.latitude},${coord.longitude}`).join("|")}`,
    [fitCoords, travelMode],
  );

  const initialRegion = useMemo((): Region => {
    if (fitCoords.length >= 2) {
      return regionFromCoordinates(fitCoords) ?? regionAroundPoint(fitCoords[0]);
    }
    if (fitCoords.length === 1) {
      return regionAroundPoint(fitCoords[0], 0.035);
    }
    return { latitude: 43.238949, longitude: 76.945465, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  }, [fitCoords]);

  const fitMapToRoute = useCallback(() => {
    if (fitCoords.length === 0) return;
    requestAnimationFrame(() => {
      if (fitCoords.length === 1) {
        mapRef.current?.animateToRegion(regionAroundPoint(fitCoords[0], 0.035), 320);
        return;
      }
      mapRef.current?.fitToCoordinates(fitCoords, {
        edgePadding: MAP_EDGE_PADDING,
        animated: true,
      });
    });
  }, [fitCoords]);

  useEffect(() => {
    userAdjustedMapRef.current = false;
  }, [fitRouteKey]);

  useEffect(() => {
    if (userAdjustedMapRef.current) return;
    fitMapToRoute();
  }, [fitMapToRoute, fitRouteKey]);

  return (
    <MapView
      ref={mapRef}
      provider={mapProvider}
      style={StyleSheet.absoluteFillObject}
      initialRegion={initialRegion}
      scrollEnabled
      zoomEnabled
      zoomTapEnabled
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      onRegionChange={() => {
        userAdjustedMapRef.current = true;
      }}
    >
      {polylineCoords.length >= 2 ? (
        <Polyline coordinates={polylineCoords} strokeColor={accentColor} strokeWidth={4} />
      ) : null}
      {points.map((point) => (
        <RouteNumberMarker
          key={`${point.venueId}-${point.order}`}
          order={point.order}
          latitude={point.latitude}
          longitude={point.longitude}
          accentColor={accentColor}
          labelColor={labelColor}
        />
      ))}
    </MapView>
  );
}

const markerStyles = StyleSheet.create({
  bubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
  },
});
