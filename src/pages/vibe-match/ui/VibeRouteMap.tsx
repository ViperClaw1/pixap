import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { TravelMode } from "@/shared/lib/directionsApi";
import { regionAroundPoint, regionFromCoordinates } from "@/shared/lib/mapRegion";
import type { LatLng } from "@/shared/lib/polylineDecode";
import type { VibeRouteMapPoint } from "../lib/useVibePlanMapPoints";

const MAP_HEIGHT = 200;
const MAP_EDGE_PADDING = { top: 48, right: 36, bottom: 52, left: 36 };

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const ROUTE_MODES: Array<{ key: TravelMode; labelKey: string; icon: IoniconName }> = [
  { key: "driving", labelKey: "vibeMatch.routeMapDrive", icon: "car-outline" },
  { key: "walking", labelKey: "vibeMatch.routeMapWalk", icon: "walk-outline" },
  { key: "transit", labelKey: "vibeMatch.routeMapTransit", icon: "bus-outline" },
];

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
  onTravelModeChange: (mode: TravelMode) => void;
  isLoading?: boolean;
  loadingLabel?: string;
  missingCount?: number;
  durationText?: string | null;
  distanceText?: string | null;
  usesStraightFallback?: boolean;
};

export function VibeRouteMap({
  points,
  polylineCoords,
  travelMode,
  onTravelModeChange,
  isLoading = false,
  loadingLabel,
  missingCount = 0,
  durationText = null,
  distanceText = null,
  usesStraightFallback = false,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const mapRef = useRef<MapView | null>(null);
  const userAdjustedMapRef = useRef(false);

  const mapProvider = PROVIDER_GOOGLE;
  const activeMode = ROUTE_MODES.find((mode) => mode.key === travelMode) ?? ROUTE_MODES[0];

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

  const showRouteMeta = Boolean(durationText || distanceText) && !usesStraightFallback;

  if (!isLoading && points.length === 0) {
    return (
      <View style={[styles.placeholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
          {t("vibeMatch.routeMapUnavailable")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { borderColor: colors.border }]}>
      <MapView
        ref={mapRef}
        provider={mapProvider}
        style={styles.map}
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
          <Polyline coordinates={polylineCoords} strokeColor={colors.accent} strokeWidth={4} />
        ) : null}
        {points.map((point) => (
          <RouteNumberMarker
            key={`${point.venueId}-${point.order}`}
            order={point.order}
            latitude={point.latitude}
            longitude={point.longitude}
            accentColor={colors.accent}
            labelColor={colors.onAccent}
          />
        ))}
      </MapView>
      {isLoading ? (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <ActivityIndicator color={colors.primary} />
          {loadingLabel ? (
            <Text style={[styles.loadingLabel, { color: colors.text }]}>{loadingLabel}</Text>
          ) : null}
        </View>
      ) : null}
      {showRouteMeta ? (
        <View style={[styles.routeMeta, { backgroundColor: colors.card }]} pointerEvents="none">
          <View style={styles.routeMetaRow}>
            <Ionicons name={activeMode.icon} size={12} color={colors.accent} />
            <Text style={[styles.routeMetaMode, { color: colors.textMuted }]}>{t(activeMode.labelKey)}</Text>
          </View>
          {durationText ? (
            <Text style={[styles.routeMetaValue, { color: colors.text }]}>{durationText}</Text>
          ) : null}
          {distanceText ? (
            <Text style={[styles.routeMetaSub, { color: colors.textMuted }]}>{distanceText}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.modeRow}>
        {ROUTE_MODES.map((mode) => {
          const active = travelMode === mode.key;
          return (
            <AppPressable
              key={mode.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(mode.labelKey)}
              disabled={isLoading}
              onPress={() => {
                if (mode.key === travelMode) return;
                onTravelModeChange(mode.key);
              }}
              style={[
                styles.modeChip,
                { backgroundColor: "#ffffff", borderColor: colors.border },
                active && { borderColor: colors.accent },
              ]}
            >
              <Ionicons name={mode.icon} size={13} color={active ? colors.accent : "#71717a"} />
              <Text
                style={[
                  styles.modeChipText,
                  { color: active ? colors.accent : "#71717a" },
                  active && { fontWeight: "800" },
                ]}
              >
                {t(mode.labelKey)}
              </Text>
            </AppPressable>
          );
        })}
      </View>
      {missingCount > 0 && points.length > 0 ? (
        <View style={[styles.missingBadge, { backgroundColor: colors.card }]} pointerEvents="none">
          <Text style={[styles.missingBadgeText, { color: colors.textMuted }]}>
            {t("vibeMatch.routeMapPartial", { count: missingCount })}
          </Text>
        </View>
      ) : null}
    </View>
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

const styles = StyleSheet.create({
  wrap: {
    height: MAP_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
    gap: 10,
    paddingHorizontal: 20,
  },
  loadingLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  placeholder: {
    height: MAP_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  placeholderText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  routeMeta: {
    position: "absolute",
    left: 8,
    top: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 2,
    opacity: 0.94,
  },
  routeMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  routeMetaMode: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  routeMetaValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  routeMetaSub: {
    fontSize: 11,
    fontWeight: "600",
  },
  modeRow: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  modeChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  missingBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    opacity: 0.92,
  },
  missingBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
});
