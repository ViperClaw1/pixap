import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { env } from "@/lib/env";
import { fetchDirections, geocodeAddress, type TravelMode } from "@/lib/directionsApi";
import type { LatLng } from "@/lib/polylineDecode";
import { regionAroundPoint, regionFromCoordinates } from "@/lib/mapRegion";
import { useAppTheme } from "@/contexts/ThemeContext";

type Props = {
  visible: boolean;
  onClose: () => void;
  placeName: string;
  address: string;
};

const MODES: { key: TravelMode; label: string }[] = [
  { key: "driving", label: "Drive" },
  { key: "walking", label: "Walk" },
  { key: "transit", label: "Transit" },
];

export function DirectionsModal({ visible, onClose, placeName, address }: Props) {
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const mapRef = useRef<MapView | null>(null);
  const fetchGeneration = useRef(0);
  const [mapReady, setMapReady] = useState(false);

  const apiKey = env.googleMapsApiKey;

  const [expanded, setExpanded] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [destCoord, setDestCoord] = useState<LatLng | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [durationText, setDurationText] = useState<string | null>(null);
  const [distanceText, setDistanceText] = useState<string | null>(null);

  const collapsedMaxH = screenH * 0.46;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        sheetExpanded: {
          flex: 1,
          marginTop: insets.top,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          maxHeight: screenH,
        },
        sheetCollapsed: {
          maxHeight: collapsedMaxH,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 8,
          gap: 8,
        },
        headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text },
        iconBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        address: { paddingHorizontal: 16, fontSize: 13, color: colors.textMuted, marginBottom: 8 },
        map: {
          width: "100%",
          minHeight: expanded ? 200 : 160,
          flex: expanded ? 1 : undefined,
        },
        banner: {
          marginHorizontal: 16,
          marginBottom: 8,
          padding: 10,
          borderRadius: 10,
          backgroundColor: isDark ? "rgba(234,179,8,0.15)" : "rgba(234,179,8,0.2)",
        },
        bannerText: { fontSize: 12, color: colors.text },
        errorBox: {
          marginHorizontal: 16,
          marginBottom: 8,
          padding: 10,
          borderRadius: 10,
          backgroundColor: isDark ? "rgba(248,113,113,0.12)" : "rgba(220,38,38,0.08)",
        },
        errorText: { fontSize: 12, color: colors.danger },
        footer: {
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Platform.OS === "ios" ? Math.max(insets.bottom, 16) : 16,
          gap: 10,
        },
        metaRow: { flexDirection: "row", gap: 12, alignItems: "center" },
        metaText: { fontSize: 13, fontWeight: "600", color: colors.text },
        modeRow: { flexDirection: "row", gap: 8 },
        modeChip: {
          flex: 1,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: colors.border,
          alignItems: "center",
        },
        modeChipActive: { backgroundColor: colors.primary },
        modeLabel: { fontSize: 12, fontWeight: "700", color: colors.text },
        modeLabelActive: { color: colors.onPrimary },
        closeBtn: { alignItems: "center", paddingVertical: 8 },
        closeText: { fontSize: 14, color: colors.link, fontWeight: "600" },
        configBox: { padding: 20 },
        configTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 8 },
        configBody: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
      }),
    [colors, isDark, insets.bottom, insets.top, screenH, collapsedMaxH, expanded],
  );

  const loadRoute = useCallback(async () => {
    const trimmed = address?.trim();
    if (!trimmed || !apiKey) return;

    const gen = ++fetchGeneration.current;

    const stale = () => gen !== fetchGeneration.current;

    setLoading(true);
    setError(null);
    setRouteCoords([]);
    setDurationText(null);
    setDistanceText(null);

    try {
      const dest = await geocodeAddress(trimmed, apiKey);
      if (stale()) return;
      if (!dest) {
        setError("Could not find this address on the map.");
        setDestCoord(null);
        setLoading(false);
        return;
      }
      setDestCoord(dest);

      const perm = await Location.requestForegroundPermissionsAsync();
      if (stale()) return;
      if (perm.status !== Location.PermissionStatus.GRANTED) {
        setPermissionDenied(true);
        setUserLoc(null);
        setLoading(false);
        requestAnimationFrame(() => {
          if (stale()) return;
          mapRef.current?.animateToRegion(regionAroundPoint(dest, 0.028), 400);
        });
        return;
      }

      setPermissionDenied(false);
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (stale()) return;
      const origin: LatLng = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setUserLoc(origin);

      const result = await fetchDirections({
        apiKey,
        origin,
        destination: trimmed,
        mode: travelMode,
      });
      if (stale()) return;

      if (!result.ok) {
        const hint =
          result.status === "ZERO_RESULTS"
            ? `No ${travelMode} route found. Try another mode or check the address. Transit is limited in some areas.`
            : result.status === "REQUEST_DENIED"
              ? "Directions request denied. Check API key, billing, and enabled APIs (Directions, Geocoding)."
              : result.message ?? result.status;
        setError(hint);
        setLoading(false);
        return;
      }

      setError(null);
      setRouteCoords(result.data.coordinates);
      setDurationText(result.data.durationText);
      setDistanceText(result.data.distanceText);
      setLoading(false);

    } catch (e) {
      if (stale()) return;
      setError(e instanceof Error ? e.message : "Could not load directions.");
      setLoading(false);
    }
  }, [address, apiKey, travelMode]);

  useEffect(() => {
    if (!visible) {
      fetchGeneration.current += 1;
      setMapReady(false);
      setExpanded(false);
      setTravelMode("driving");
      setError(null);
      setRouteCoords([]);
      setUserLoc(null);
      setDestCoord(null);
      setPermissionDenied(false);
      setDurationText(null);
      setDistanceText(null);
      return;
    }
    void loadRoute();
  }, [visible, loadRoute]);

  /** Re-apply zoom when map becomes ready, route updates, or sheet expands (layout changes). */
  useEffect(() => {
    if (!visible || !mapReady || !destCoord) return;

    const coords: LatLng[] =
      routeCoords.length > 1 ? routeCoords : userLoc ? [userLoc, destCoord] : [destCoord];

    if (coords.length < 2) {
      mapRef.current?.animateToRegion(regionAroundPoint(destCoord, 0.035), 350);
      return;
    }

    const region = regionFromCoordinates(coords);
    if (!region) return;

    const apply = () => mapRef.current?.animateToRegion(region, 500);
    apply();
    const t1 = setTimeout(apply, 160);
    const t2 = setTimeout(apply, 480);
    const t3 = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        coords.map((c) => ({ latitude: c.latitude, longitude: c.longitude })),
        { edgePadding: { top: 76, right: 24, bottom: 112, left: 24 }, animated: true },
      );
    }, 220);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [visible, mapReady, destCoord, routeCoords, userLoc, expanded]);

  const initialRegion = useMemo(
    () => (destCoord ? regionAroundPoint(destCoord, 0.038) : null),
    [destCoord],
  );

  const polylineCoords = routeCoords.length > 1 ? routeCoords : [];
  const mapProvider = Platform.OS === "android" || Platform.OS === "ios" ? PROVIDER_GOOGLE : undefined;

  if (!apiKey) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, styles.sheetCollapsed, styles.configBox]}>
            <Text style={styles.configTitle}>Maps not configured</Text>
            <Text style={styles.configBody}>
              Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your environment. Enable in Google Cloud: Maps SDK for
              Android, Maps SDK for iOS, Directions API, and Geocoding API. Rebuild the native app after adding
              the key.
            </Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, expanded ? styles.sheetExpanded : styles.sheetCollapsed]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {placeName}
            </Text>
            <Pressable
              style={styles.iconBtn}
              onPress={() => setExpanded((e) => !e)}
              accessibilityLabel={expanded ? "Collapse map" : "Expand map"}
            >
              <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={22} color={colors.text} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={onClose} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.address} numberOfLines={2}>
            {address}
          </Text>

          {permissionDenied ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                Location permission denied — showing destination only. Enable location in settings to see routes
                from your position.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={expanded ? { flex: 1 } : undefined}>
            {destCoord && initialRegion ? (
              <MapView
                ref={mapRef}
                provider={mapProvider}
                style={styles.map}
                initialRegion={initialRegion}
                onMapReady={() => setMapReady(true)}
                showsUserLocation={!permissionDenied && !!userLoc}
                showsMyLocationButton={false}
              >
                {polylineCoords.length > 0 ? (
                  <Polyline
                    coordinates={polylineCoords}
                    strokeColor={colors.link}
                    strokeWidth={4}
                  />
                ) : null}
                {userLoc ? (
                  <Marker coordinate={userLoc} title="You" identifier="user" pinColor="#22c55e" />
                ) : null}
                <Marker coordinate={destCoord} title={placeName} identifier="dest" pinColor="#ef4444" />
              </MapView>
            ) : (
              <View style={[styles.map, { alignItems: "center", justifyContent: "center" }]}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 8 }} color={colors.primary} />
          ) : null}

          <View style={styles.footer}>
            {(durationText || distanceText) && !loading ? (
              <View style={styles.metaRow}>
                {durationText ? <Text style={styles.metaText}>{durationText}</Text> : null}
                {distanceText ? <Text style={styles.metaText}>{distanceText}</Text> : null}
              </View>
            ) : null}

            <View style={styles.modeRow}>
              {MODES.map(({ key, label }) => {
                const active = travelMode === key;
                return (
                  <Pressable
                    key={key}
                    style={[styles.modeChip, active && styles.modeChipActive]}
                    onPress={() => {
                      if (key === travelMode || loading) return;
                      setTravelMode(key);
                    }}
                    disabled={loading}
                  >
                    <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
