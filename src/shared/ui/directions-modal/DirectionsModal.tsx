import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
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
} from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { env } from "@/shared/lib/env";
import { fetchDirections, geocodeAddressDetailed, type TravelMode } from "@/shared/lib/directionsApi";
import type { LatLng } from "@/shared/lib/polylineDecode";
import { regionAroundPoint, regionFromCoordinates, type MapRegion } from "@/shared/lib/mapRegion";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useDirectionsModalStyles } from "./directionsModalStyles";

/** Стабильные маркеры: стабильный `coordinate` + `tracksViewChanges={false}` — меньше перерисовок нативных аннотаций. */
const DirectionsUserMarker = memo(function DirectionsUserMarker({ coordinate }: { coordinate: LatLng }) {
  const stable = useMemo(() => ({ latitude: coordinate.latitude, longitude: coordinate.longitude }), [coordinate]);
  return <Marker coordinate={stable} title="You" pinColor="#22c55e" tracksViewChanges={false} />;
});

const DirectionsDestMarker = memo(function DirectionsDestMarker({
  coordinate,
  title,
}: {
  coordinate: LatLng;
  title: string;
}) {
  const stable = useMemo(() => ({ latitude: coordinate.latitude, longitude: coordinate.longitude }), [coordinate]);
  return <Marker coordinate={stable} title={title} pinColor="#ef4444" tracksViewChanges={false} />;
});

type Props = {
  visible: boolean;
  onClose: () => void;
  placeName: string;
  address: string;
};

const ROUTE_POLYLINE_MAX_POINTS = 260;

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

  if (deduped.length <= ROUTE_POLYLINE_MAX_POINTS) return deduped;
  const step = Math.ceil(deduped.length / ROUTE_POLYLINE_MAX_POINTS);
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
  const closingViaSwipeRef = useRef(false);
  const swipeY = useSharedValue(0);
  const sheetScreenH = useSharedValue(screenH);
  const mapRef = useRef<MapView | null>(null);

  const apiKey = env.googleMapsWebApiKey;

  const fitMapRegion = useCallback((region: MapRegion) => {
    requestAnimationFrame(() => {
      mapRef.current?.animateToRegion(region, 420);
    });
  }, []);

  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [destCoord, setDestCoord] = useState<LatLng | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [durationText, setDurationText] = useState<string | null>(null);
  const [distanceText, setDistanceText] = useState<string | null>(null);

  const destCoordRef = useRef(destCoord);
  destCoordRef.current = destCoord;
  const routeCoordsRef = useRef(routeCoords);
  routeCoordsRef.current = routeCoords;

  const styles = useDirectionsModalStyles(insets.top, insets.bottom, screenH);

  useEffect(() => {
    sheetScreenH.value = screenH;
  }, [screenH, sheetScreenH]);

  const sheetSwipeStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: swipeY.value }],
    }),
    [swipeY],
  );

  const onCloseAfterSwipe = useCallback(() => {
    closingViaSwipeRef.current = true;
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    closingViaSwipeRef.current = false;
    onClose();
  }, [onClose]);

  const modalAnimationType =
    Platform.OS === "ios" && closingViaSwipeRef.current && !visible ? "none" : "slide";

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .onUpdate((e) => {
          swipeY.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          const shouldClose = e.translationY > 90 || e.velocityY > 800;
          if (shouldClose) {
            swipeY.value = withTiming(sheetScreenH.value, { duration: 180 }, (finished) => {
              if (finished) {
                runOnJS(onCloseAfterSwipe)();
              }
            });
          } else {
            swipeY.value = withSpring(0, { damping: 18, stiffness: 200 });
          }
        }),
    [onCloseAfterSwipe, sheetScreenH, swipeY],
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
      let dest: LatLng | null = destCoordRef.current;
      let lastGeocodeStatus: string | null = null;
      let geocodeCandidates: string[] = [];
      if (!dest) {
        geocodeCandidates = buildGeocodeCandidates(trimmed, placeName);
        for (const candidate of geocodeCandidates) {
          const geocodeResult = await geocodeAddressDetailed(candidate, apiKey, controller.signal);
          if (geocodeResult.ok) {
            dest = geocodeResult.location;
            break;
          }
          lastGeocodeStatus = geocodeResult.status;
        }

        if (!dest) {
          for (const candidate of geocodeCandidates) {
            try {
              const fallback = await Location.geocodeAsync(candidate);
              const first = fallback[0];
              if (!first) continue;
              dest = { latitude: first.latitude, longitude: first.longitude };
              break;
            } catch {
              // no-op; keep trying next candidate
            }
          }
        }
      }

      if (stale()) return;
      if (!dest) {
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
      if (routeCoordsRef.current.length < 2) {
        fitMapRegion(regionAroundPoint(dest, 0.035));
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
        if (routeCoordsRef.current.length < 2) {
          fitMapRegion(regionAroundPoint(dest, 0.032));
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
      }
      if (routeCoordsRef.current.length < 2 && isFiniteCoordinate(origin) && isFiniteCoordinate(dest)) {
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

      setError(null);
      setDestCoord(endCoord);
      setRouteCoords(resolvedRouteCoords);
      const routeRegion =
        resolvedRouteCoords.length >= 2
          ? regionFromCoordinates(resolvedRouteCoords)
          : regionAroundPoint(endCoord, 0.032);
      if (routeRegion) fitMapRegion(routeRegion);
      setDurationText(result.data.durationText);
      setDistanceText(result.data.distanceText);
      setLoading(false);

    } catch (e) {
      if (controller.signal.aborted) return;
      if (stale()) return;
      setError(e instanceof Error ? e.message : "Could not load directions.");
      setLoading(false);
    }
  }, [address, apiKey, fitMapRegion, placeName, travelMode]);

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
    if (!visible) {
      fetchGeneration.current += 1;
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
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
    closingViaSwipeRef.current = false;
    swipeY.value = 0;
    void loadRoute();
  }, [visible, loadRoute, swipeY]);

  const initialRegion = useMemo(
    () => regionAroundPoint(destCoord ?? { latitude: 40.1792, longitude: 44.4991 }, 0.04),
    [destCoord],
  );

  const polylineCoords = useMemo(() => (routeCoords.length >= 2 ? routeCoords : []), [routeCoords]);
  // iOS + Google provider can be unstable in Expo Go during frequent route updates.
  const mapProvider = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

  if (!apiKey) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, styles.sheetExpanded, styles.configBox]}>
            <Text style={styles.configTitle}>Maps not configured</Text>
            <Text style={styles.configBody}>
              Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your environment. Enable in Google Cloud: Maps SDK for
              Android, Maps SDK for iOS, Directions API, and Geocoding API. Rebuild the native app after adding
              the key.
            </Text>
            <Pressable style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType={modalAnimationType} transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.sheet, styles.sheetExpanded, sheetSwipeStyle]}>
          <GestureDetector gesture={panGesture}>
            <View>
              <View style={styles.curtainWrap}>
                <View style={styles.curtain} />
              </View>
              <View style={styles.header}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {placeName}
                </Text>
                <Pressable style={styles.iconBtn} onPress={handleClose} accessibilityLabel="Close">
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>
            </View>
          </GestureDetector>

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
              ref={mapRef}
              provider={mapProvider}
              style={styles.map}
              initialRegion={initialRegion}
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
              {userLoc ? <DirectionsUserMarker coordinate={userLoc} /> : null}
              {destCoord ? <DirectionsDestMarker coordinate={destCoord} title={placeName} /> : null}
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

            <Pressable style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
