import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { VibeRouteMapInteractive } from "@/components/maps";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { TravelMode } from "@/shared/lib/directionsApi";
import type { LatLng } from "@/shared/lib/polylineDecode";
import type { VibeRouteMapPoint } from "../lib/useVibePlanMapPoints";

const MAP_HEIGHT = 200;

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const ROUTE_MODES: Array<{ key: TravelMode; labelKey: string; icon: IoniconName }> = [
  { key: "driving", labelKey: "vibeMatch.routeMapDrive", icon: "car-outline" },
  { key: "walking", labelKey: "vibeMatch.routeMapWalk", icon: "walk-outline" },
  { key: "transit", labelKey: "vibeMatch.routeMapTransit", icon: "bus-outline" },
];

type Props = {
  points: VibeRouteMapPoint[];
  polylineCoords: LatLng[];
  travelMode: TravelMode;
  onTravelModeChange: (mode: TravelMode) => void;
  isLoading?: boolean;
  loadingLabel?: string;
  loadingOverlayLight?: boolean;
  missingCount?: number;
  durationText?: string | null;
  distanceText?: string | null;
  usesStraightFallback?: boolean;
  highlightedVenueId?: string | null;
  onMarkerPress?: (venueId: string) => void;
};

export function VibeRouteMap({
  points,
  polylineCoords,
  travelMode,
  onTravelModeChange,
  isLoading = false,
  loadingLabel,
  loadingOverlayLight = false,
  missingCount = 0,
  durationText = null,
  distanceText = null,
  usesStraightFallback = false,
  highlightedVenueId = null,
  onMarkerPress,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const activeMode = ROUTE_MODES.find((mode) => mode.key === travelMode) ?? ROUTE_MODES[0];
  const showRouteMeta = Boolean(durationText || distanceText) && !usesStraightFallback;
  const loadingSpinnerColor = loadingOverlayLight ? "#ffffff" : colors.primary;
  const loadingTextColor = loadingOverlayLight ? "#ffffff" : colors.text;

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
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
      {points.length > 0 ? (
        <VibeRouteMapInteractive
          points={points}
          polylineCoords={polylineCoords}
          travelMode={travelMode}
          accentColor={colors.accent}
          labelColor={colors.onAccent}
          highlightedVenueId={highlightedVenueId}
          onMarkerPress={onMarkerPress}
        />
      ) : (
        <View style={[styles.mapFallback, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      {isLoading ? (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <ActivityIndicator color={loadingSpinnerColor} />
          {loadingLabel ? (
            <Text style={[styles.loadingLabel, { color: loadingTextColor }]}>{loadingLabel}</Text>
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

const styles = StyleSheet.create({
  wrap: {
    height: MAP_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
  mapFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
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
