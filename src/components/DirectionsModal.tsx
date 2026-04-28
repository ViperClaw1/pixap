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
  Alert,
  Linking,
  Animated,
  PanResponder,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { env } from "@/lib/env";
import { fetchDirections, geocodeAddressDetailed, type TravelMode } from "@/lib/directionsApi";
import type { LatLng } from "@/lib/polylineDecode";
import { regionAroundPoint, regionFromCoordinates, type MapRegion } from "@/lib/mapRegion";
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

function normalizeAddressInput(value: string): string {
  return value
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function buildGeocodeCandidates(address: string, placeName: string): string[] {
  const base = normalizeAddressInput(address);
  const noUnit = normalizeAddressInput(
    base
      .replace(/\b(?:apt|apartment|suite|ste|unit)\s*[\w-]+/gi, "")
      .replace(/#\s*[\w-]+/g, ""),
  );
  const withName = normalizeAddressInput(`${placeName}, ${base}`);
  const withNameNoUnit = normalizeAddressInput(`${placeName}, ${noUnit}`);

  return [base, noUnit, withName, withNameNoUnit].filter(
    (candidate, idx, arr) => Boolean(candidate) && arr.indexOf(candidate) === idx,
  );
}

function debugDirectionsLog(event: string, payload?: unknown) {
  if (!__DEV__) return;
  if (payload === undefined) {
    console.log(`[DirectionsModal][debug] ${event}`);
    return;
  }
  console.log(`[DirectionsModal][debug] ${event}`, payload);
}

function isFiniteCoordinate(value: LatLng | null | undefined): value is LatLng {
  return Boolean(
    value &&
      Number.isFinite(value.latitude) &&
      Number.isFinite(value.longitude) &&
      Math.abs(value.latitude) <= 90 &&
      Math.abs(value.longitude) <= 180,
  );
}

function buildRenderableRoute(coords: LatLng[]): LatLng[] {
  if (coords.length < 2) return [];
  const safe = coords.filter(isFiniteCoordinate);
  if (safe.length < 2) return [];

  const deduped: LatLng[] = [safe[0]];
  for (let i = 1; i < safe.length; i += 1) {
    const prev = deduped[deduped.length - 1];
    const cur = safe[i];
    if (Math.abs(prev.latitude - cur.latitude) < 1e-7 && Math.abs(prev.longitude - cur.longitude) < 1e-7) {
      continue;
    }
    deduped.push(cur);
  }
  if (deduped.length < 2) return [];

  const maxPoints = 260;
  if (deduped.length <= maxPoints) return deduped;
  const step = Math.ceil(deduped.length / maxPoints);
  const compact: LatLng[] = [];
  for (let i = 0; i < deduped.length; i += step) compact.push(deduped[i]);
  const last = deduped[deduped.length - 1];
  const tail = compact[compact.length - 1];
  if (!tail || tail.latitude !== last.latitude || tail.longitude !== last.longitude) compact.push(last);
  return compact;
}

export function DirectionsModal({ visible, onClose, placeName, address }: Props) {
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const fetchGeneration = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const swipeY = useRef(new Animated.Value(0)).current;
  const [mapRegion, setMapRegion] = useState<MapRegion | null>(null);

  const apiKey = env.googleMapsWebApiKey;

  const expanded = true;
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [destCoord, setDestCoord] = useState<LatLng | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [durationText, setDurationText] = useState<string | null>(null);
  const [distanceText, setDistanceText] = useState<string | null>(null);

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
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          maxHeight: screenH,
        },
        curtainWrap: {
          alignItems: "center",
          paddingTop: 8,
          paddingBottom: 2,
        },
        curtain: {
          width: 44,
          height: 5,
          borderRadius: 999,
          backgroundColor: colors.textMuted,
          opacity: 0.65,
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
          minHeight: 220,
          flex: 1,
        },
        banner: {
          marginHorizontal: 16,
          marginBottom: 8,
          padding: 10,
          borderRadius: 10,
          backgroundColor: isDark ? "rgba(234,179,8,0.15)" : "rgba(234,179,8,0.2)",
        },
        bannerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        bannerIconBtn: {
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)",
        },
        bannerText: { fontSize: 12, color: colors.text, flex: 1, flexShrink: 1, lineHeight: 16 },
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
    [colors, isDark, insets.bottom, insets.top, screenH],
  );

  const closeWithSwipe = useCallback(() => {
    Animated.timing(swipeY, {
      toValue: screenH,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      swipeY.setValue(0);
      onClose();
    });
  }, [onClose, screenH, swipeY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          swipeY.setValue(Math.max(0, g.dy));
        },
        onPanResponderRelease: (_, g) => {
          const shouldClose = g.dy > 90 || g.vy > 1;
          if (shouldClose) {
            closeWithSwipe();
            return;
          }
          Animated.spring(swipeY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
            speed: 24,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(swipeY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
            speed: 24,
          }).start();
        },
      }),
    [closeWithSwipe, swipeY],
  );

  const loadRoute = useCallback(async () => {
    const trimmed = address?.trim();
    if (!trimmed || !apiKey) return;

    const gen = ++fetchGeneration.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    const stale = () => gen !== fetchGeneration.current || controller.signal.aborted;

    setLoading(true);
    setError(null);
    setDurationText(null);
    setDistanceText(null);

    try {
      debugDirectionsLog("loadRoute:start", {
        placeName,
        address: trimmed,
        travelMode,
        apiKeyLength: apiKey.length,
        apiKeyPrefix: apiKey.slice(0, 7),
        apiKeySuffix: apiKey.slice(-4),
      });

      let dest: LatLng | null = destCoord;
      let lastGeocodeStatus: string | null = null;
      let lastGeocodeMessage: string | undefined;
      let geocodeCandidates: string[] = [];
      if (!dest) {
        geocodeCandidates = buildGeocodeCandidates(trimmed, placeName);
        debugDirectionsLog("geocode:candidates", geocodeCandidates);
        for (const candidate of geocodeCandidates) {
          debugDirectionsLog("geocode:try", { candidate });
          const geocodeResult = await geocodeAddressDetailed(candidate, apiKey, controller.signal);
          if (geocodeResult.ok) {
            dest = geocodeResult.location;
            debugDirectionsLog("geocode:success", { candidate, dest });
            break;
          }
          lastGeocodeStatus = geocodeResult.status;
          lastGeocodeMessage = geocodeResult.message;
          debugDirectionsLog("geocode:fail", {
            candidate,
            status: geocodeResult.status,
            message: geocodeResult.message,
          });
        }

        if (!dest) {
          for (const candidate of geocodeCandidates) {
            try {
              debugDirectionsLog("expoGeocode:try", { candidate });
              const fallback = await Location.geocodeAsync(candidate);
              const first = fallback[0];
              if (!first) continue;
              dest = { latitude: first.latitude, longitude: first.longitude };
              debugDirectionsLog("expoGeocode:success", { candidate, dest });
              break;
            } catch {
              debugDirectionsLog("expoGeocode:error", { candidate });
              // no-op; keep trying next candidate
            }
          }
        }
      } else {
        debugDirectionsLog("geocode:reuse_cached_dest", dest);
      }

      if (stale()) return;
      if (!dest) {
        debugDirectionsLog("geocode:all_failed", {
          lastGeocodeStatus,
          lastGeocodeMessage,
          candidates: geocodeCandidates,
        });
        if (lastGeocodeStatus === "REQUEST_DENIED") {
          setError("Geocoding request denied. Check key restrictions, billing, and Geocoding API access.");
        } else if (lastGeocodeStatus === "OVER_QUERY_LIMIT") {
          setError("Geocoding quota exceeded. Please try again later.");
        } else {
          setError("Could not find this address on the map.");
        }
        setDestCoord(null);
        setLoading(false);
        return;
      }
      setDestCoord(dest);
      if (routeCoords.length < 2) {
        setMapRegion(regionAroundPoint(dest, 0.035));
      }

      const currentPerm = await Location.getForegroundPermissionsAsync();
      const perm =
        currentPerm.status === Location.PermissionStatus.GRANTED
          ? currentPerm
          : await Location.requestForegroundPermissionsAsync();
      if (stale()) return;
      if (perm.status !== Location.PermissionStatus.GRANTED) {
        setPermissionDenied(true);
        setUserLoc(null);
        setLoading(false);
        if (routeCoords.length < 2) {
          setMapRegion(regionAroundPoint(dest, 0.032));
        }
        return;
      }

      setPermissionDenied(false);
      let origin = userLoc;
      if (!origin) {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (stale()) return;
        origin = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setUserLoc(origin);
      } else {
        debugDirectionsLog("location:reuse_cached_origin", origin);
      }
      if (routeCoords.length < 2 && isFiniteCoordinate(origin) && isFiniteCoordinate(dest)) {
        setRouteCoords([origin, dest]);
      }

      const result = await fetchDirections({
        apiKey,
        origin,
        destination: `${dest.latitude},${dest.longitude}`,
        mode: travelMode,
        signal: controller.signal,
      });
      if (stale()) return;
      debugDirectionsLog("directions:result", result.ok ? { ok: true } : result);

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

      const startCoord = isFiniteCoordinate(result.data.startLocation) ? result.data.startLocation : origin;
      const endCoord = isFiniteCoordinate(result.data.endLocation) ? result.data.endLocation : dest;
      const decodedRoute = buildRenderableRoute(result.data.coordinates);
      const resolvedRouteCoords =
        decodedRoute.length >= 2
          ? decodedRoute
          : isFiniteCoordinate(startCoord) && isFiniteCoordinate(endCoord)
            ? [startCoord, endCoord]
            : [];
      debugDirectionsLog("directions:assign_route", {
        travelMode,
        startCoord,
        endCoord,
        decodedPoints: result.data.coordinates.length,
        renderedPoints: decodedRoute.length,
        assignedPoints: resolvedRouteCoords.length,
      });

      setError(null);
      setDestCoord(endCoord);
      setRouteCoords(resolvedRouteCoords);
      const routeRegion =
        resolvedRouteCoords.length >= 2
          ? regionFromCoordinates(resolvedRouteCoords)
          : regionAroundPoint(endCoord, 0.032);
      if (routeRegion) setMapRegion(routeRegion);
      setDurationText(result.data.durationText);
      setDistanceText(result.data.distanceText);
      setLoading(false);

    } catch (e) {
      if (controller.signal.aborted) return;
      if (stale()) return;
      setError(e instanceof Error ? e.message : "Could not load directions.");
      setLoading(false);
    }
  }, [address, apiKey, placeName, travelMode, routeCoords.length]);

  const retryLocationPermission = useCallback(async () => {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === Location.PermissionStatus.GRANTED) {
      setPermissionDenied(false);
      void loadRoute();
      return;
    }

    if (!current.canAskAgain) {
      Alert.alert(
        "Location permission needed",
        "Location access is blocked for this app. Open settings to enable it and see routes from your position.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open settings",
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ],
      );
      return;
    }

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== Location.PermissionStatus.GRANTED) {
      setPermissionDenied(true);
      return;
    }

    setPermissionDenied(false);
    void loadRoute();
  }, [loadRoute]);

  useEffect(() => {
    debugDirectionsLog("state:routeCoords_changed", {
      travelMode,
      points: routeCoords.length,
      first: routeCoords[0] ?? null,
      last: routeCoords[routeCoords.length - 1] ?? null,
    });
  }, [routeCoords, travelMode]);

  useEffect(() => {
    if (!visible) {
      fetchGeneration.current += 1;
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      setMapRegion(null);
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
    swipeY.setValue(0);
    void loadRoute();
  }, [visible, loadRoute, swipeY]);

  const initialRegion = useMemo(
    () => regionAroundPoint(destCoord ?? { latitude: 40.1792, longitude: 44.4991 }, 0.04),
    [destCoord],
  );

  const polylineCoords = routeCoords.length >= 2 ? routeCoords : [];
  // iOS + Google provider can be unstable in Expo Go during frequent route updates.
  const mapProvider = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

  if (!apiKey) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, styles.sheetExpanded, styles.configBox]}>
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
        <Animated.View style={[styles.sheet, styles.sheetExpanded, { transform: [{ translateY: swipeY }] }]}>
          <View style={styles.curtainWrap} {...panResponder.panHandlers}>
            <View style={styles.curtain} />
          </View>
          <View style={styles.header} {...panResponder.panHandlers}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {placeName}
            </Text>
            <Pressable style={styles.iconBtn} onPress={onClose} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.address} numberOfLines={2}>
            {address}
          </Text>

          {permissionDenied ? (
            <View style={styles.banner}>
              <View style={styles.bannerRow}>
                <Pressable
                  style={styles.bannerIconBtn}
                  onPress={() => void retryLocationPermission()}
                  accessibilityRole="button"
                  accessibilityLabel="Request location permission again"
                >
                  <Ionicons name="locate-outline" size={16} color={colors.text} />
                </Pressable>
                <Text style={styles.bannerText}>
                  Location permission denied — showing destination only. Enable location in settings to see routes
                  from your position.
                </Text>
              </View>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={{ flex: 1 }}>
            <MapView
              provider={mapProvider}
              style={styles.map}
              initialRegion={initialRegion}
              region={mapRegion ?? initialRegion}
              onMapReady={() => {
                debugDirectionsLog("map:onMapReady", { travelMode });
              }}
              showsUserLocation={!permissionDenied && !!userLoc}
              showsMyLocationButton={false}
            >
              {polylineCoords.length >= 2 ? (
                <Polyline
                  coordinates={polylineCoords}
                    strokeColor="#00C2FF"
                    strokeWidth={6}
                />
              ) : null}
              {userLoc ? <Marker coordinate={userLoc} title="You" pinColor="#22c55e" /> : null}
              {destCoord ? <Marker coordinate={destCoord} title={placeName} pinColor="#ef4444" /> : null}
            </MapView>
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
        </Animated.View>
      </View>
    </Modal>
  );
}
