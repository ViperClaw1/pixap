import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  InteractionManager,
  PanResponder,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  ScrollView,
  type ViewStyle,
  type TextStyle,
  type ImageStyle,
} from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import Supercluster from "supercluster";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useMyArchivedStories } from "@/entities/story";
import { rotateStoriesFromIndex } from "@/entities/story/lib/archiveViewer";
import type { StoryGroup, StoryItem } from "@/shared/model/types/stories";
import { preloadSmartImages, SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { parseStoryMediaUrls, resolveStoryStorageUrl } from "@/shared/lib/storyMediaUrls";
import { getOptimizedImageUrl, quantizeDecodePx } from "@/shared/lib/imageUtils";
import { chunkCells, toYmd, firstOfMonthContaining, type CalendarCell } from "@/shared/lib/bookingCalendar";
import { StoryArchiveGridThumb } from "./StoryArchiveGridThumb";
import { useStoriesArchiveStyles } from "./storiesArchiveStyles";

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

export type StoriesArchiveViewProps = {
  onRequestClose: () => void;
  /** Когда архив встроен в профиль и слой скрыт — не гоняем preload и лишнюю работу. */
  overlayActive?: boolean;
};

type ArchiveTab = "grid" | "calendar" | "map";

type ArchiveThumb = {
  /** Primary URL (Supabase render / resized when supported). */
  thumbUri: string;
  /** Full object URL if `thumbUri` is a transform that may fail (expo-image then loads this). */
  thumbFallbackUri?: string;
};

type GridCell = ArchiveThumb & {
  key: string;
  storyId: string;
  mediaIndex: number;
};

type CalendarThumb = ArchiveThumb;

type StoryArchiveGridCellProps = {
  item: GridCell;
  tileWidth: number;
  tileHeight: number;
  cardBackground: string;
  onPressCell: (cell: GridCell) => void;
};

const StoryArchiveGridCell = memo(function StoryArchiveGridCell({
  item,
  tileWidth,
  tileHeight,
  cardBackground,
  onPressCell,
}: StoryArchiveGridCellProps) {
  const onPress = useCallback(() => {
    onPressCell(item);
  }, [item, onPressCell]);

  return (
    <Pressable
      onPress={onPress}
      style={{ width: tileWidth, height: tileHeight, backgroundColor: cardBackground }}
    >
      <StoryArchiveGridThumb uri={item.thumbUri} fallbackUri={item.thumbFallbackUri} recyclingKey={item.key} />
    </Pressable>
  );
});

const WEEKDAYS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const GRID_COLUMNS = 3;
const GRID_BATCH_ROWS = 7;
/** Matches `calCircle` size in storiesArchiveStyles. */
const CAL_CIRCLE_SIZE = 40;
const PREFETCH_BATCH_SIZE = 8;
const ARCHIVE_TAB_ORDER: ArchiveTab[] = ["grid", "calendar", "map"];
const MAP_REGION_EDGE_PADDING = 0.02;
const MAP_REGION_MIN_DELTA = 0.08;

function buildArchiveThumb(raw: string, decodePx: number): ArchiveThumb {
  const optimized = getOptimizedImageUrl(raw, decodePx, decodePx, 72) || raw;
  return {
    thumbUri: optimized,
    thumbFallbackUri: optimized !== raw ? raw : undefined,
  };
}

async function preloadSmartImagesBatched(uris: string[]): Promise<void> {
  const unique = Array.from(new Set(uris.filter((uri) => uri.length > 0)));
  for (let i = 0; i < unique.length; i += PREFETCH_BATCH_SIZE) {
    await preloadSmartImages(unique.slice(i, i + PREFETCH_BATCH_SIZE));
  }
}

function buildMonthCellsMondayFirst(year: number, month: number): CalendarCell[] {
  const firstDow = new Date(year, month, 1).getDay();
  const lead = (firstDow + 6) % 7;
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < lead; i += 1) cells.push({ kind: "pad" });
  for (let d = 1; d <= dim; d += 1) {
    cells.push({ kind: "day", day: d, ymd: toYmd(new Date(year, month, d)) });
  }
  while (cells.length % 7 !== 0) cells.push({ kind: "pad" });
  return cells;
}

function regionToZoom(longitudeDelta: number) {
  const z = Math.log2(360 / Math.max(longitudeDelta, 1e-12));
  return Math.max(1, Math.min(18, Math.round(z)));
}

function defaultRegionForCoords(coords: Array<{ latitude: number; longitude: number }>): Region {
  if (!coords.length) {
    return { latitude: 40.1776, longitude: 44.5126, latitudeDelta: 2, longitudeDelta: 2 };
  }
  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLng = coords[0].longitude;
  let maxLng = coords[0].longitude;
  for (const c of coords) {
    minLat = Math.min(minLat, c.latitude);
    maxLat = Math.max(maxLat, c.latitude);
    minLng = Math.min(minLng, c.longitude);
    maxLng = Math.max(maxLng, c.longitude);
  }
  const latDelta = Math.max(maxLat - minLat + MAP_REGION_EDGE_PADDING, MAP_REGION_MIN_DELTA);
  const lngDelta = Math.max(maxLng - minLng + MAP_REGION_EDGE_PADDING, MAP_REGION_MIN_DELTA);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

type ClusterPointProps = { storyId: string };

type MapClusterItem = Supercluster.PointFeature<ClusterPointProps> | Supercluster.ClusterFeature<Supercluster.ClusterProperties>;

type ArchiveClusterMarkerProps = {
  clusterId: number;
  latitude: number;
  longitude: number;
  pointCount: number;
  bubbleStyle: ViewStyle;
  countTextStyle: TextStyle;
  onPress: () => void;
};

const ArchiveMapClusterMarker = memo(function ArchiveMapClusterMarker({
  clusterId,
  latitude,
  longitude,
  pointCount,
  bubbleStyle,
  countTextStyle,
  onPress,
}: ArchiveClusterMarkerProps) {
  const coordinate = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);
  return (
    <Marker
      coordinate={coordinate}
      identifier={`archive-c-${clusterId}`}
      tracksViewChanges={false}
      onPress={onPress}
    >
      <View style={bubbleStyle}>
        <Text style={countTextStyle}>{pointCount}</Text>
      </View>
    </Marker>
  );
});

type ArchiveStoryMarkerProps = {
  storyId: string;
  latitude: number;
  longitude: number;
  thumbUri: string | null;
  thumbStyle: ImageStyle;
  fallbackStyle: ViewStyle;
  onPress: () => void;
};

const ArchiveMapStoryMarker = memo(function ArchiveMapStoryMarker({
  storyId,
  latitude,
  longitude,
  thumbUri,
  thumbStyle,
  fallbackStyle,
  onPress,
}: ArchiveStoryMarkerProps) {
  const coordinate = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);
  return (
    <Marker coordinate={coordinate} identifier={`archive-s-${storyId}`} tracksViewChanges={false} onPress={onPress}>
      {thumbUri ? (
        <SmartImage uri={thumbUri} style={thumbStyle} contentFit="cover" recyclingKey={thumbUri} />
      ) : (
        <View style={fallbackStyle} />
      )}
    </Marker>
  );
});

export function StoriesArchiveView({ onRequestClose, overlayActive = true }: StoriesArchiveViewProps) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width: hookWidth, height: hookHeight } = useWindowDimensions();
  const windowBox = Dimensions.get("window");
  /** Внутри native stack ширина/высота иногда 0 до layout; без fallback плитки 0×0 и FlatList «пустой». */
  const width = Math.max(12, hookWidth > 0 ? hookWidth : windowBox.width || 375);
  const windowHeight = Math.max(1, hookHeight > 0 ? hookHeight : windowBox.height || 667);
  const { colors, mode, setMode } = useAppTheme();
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    ensureAllPagesLoaded,
  } = useMyArchivedStories();
  const stories: StoryItem[] = data?.stories ?? [];
  const coordsByStoryId = data?.coordsByStoryId ?? {};

  const tabBodyMinHeight = useMemo(() => {
    const headerTabs = Math.max(insets.top, 12) + 132;
    return Math.max(240, windowHeight - headerTabs - insets.bottom);
  }, [windowHeight, insets.top, insets.bottom]);

  const [tab, setTab] = useState<ArchiveTab>("grid");
  const [visibleMonth, setVisibleMonth] = useState(() => firstOfMonthContaining(new Date()));
  const mapRef = useRef<MapView | null>(null);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const archiveSwipeHandlers = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderRelease: (_e, g) => {
          const swipeLeft = g.dx < -56 && Math.abs(g.dx) > Math.abs(g.dy) * 1.05;
          const swipeRight = g.dx > 56 && Math.abs(g.dx) > Math.abs(g.dy) * 1.05;
          if (!swipeLeft && !swipeRight) return;
          const currentIndex = ARCHIVE_TAB_ORDER.indexOf(tab);
          if (currentIndex < 0) return;
          if (swipeLeft) {
            const nextTab = ARCHIVE_TAB_ORDER[currentIndex + 1];
            if (nextTab) setTab(nextTab);
            return;
          }
          const previousTab = ARCHIVE_TAB_ORDER[currentIndex - 1];
          if (previousTab) {
            setTab(previousTab);
            return;
          }
          onRequestClose();
        },
      }).panHandlers,
    [onRequestClose, tab],
  );

  const toggleThemeMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  const openViewer = useCallback(
    (subset: StoryItem[], initialStoryIndex: number, placeId: string, initialMediaByStoryId?: Record<string, number>) => {
      if (!subset.length) return;
      const safeInitialIndex = Math.max(0, Math.min(initialStoryIndex, subset.length - 1));
      const rotatedStories = rotateStoriesFromIndex(subset, safeInitialIndex);
      const g: StoryGroup = {
        user_id: rotatedStories[0].user_id,
        profile: rotatedStories[0].profile,
        stories: rotatedStories,
      };
      navigation.navigate("FeedStoryViewer", {
        groups: [g],
        initialGroupIndex: 0,
        initialStoryIndex: 0,
        placeId,
        initialMediaByStoryId,
      });
    },
    [navigation],
  );

  const gridTileWidth = Math.max(1, Math.floor(width / GRID_COLUMNS));
  const gridTileHeight = Math.max(1, Math.round((gridTileWidth * 16) / 9));

  const storyMediaById = useMemo(() => {
    const mediaMap = new Map<string, string[]>();
    for (const story of stories) {
      const urls = parseStoryMediaUrls(story.media_url).map((u) => resolveStoryStorageUrl(u));
      mediaMap.set(story.id, urls);
    }
    return mediaMap;
  }, [stories]);

  const gridItems = useMemo((): GridCell[] => {
    const dpr = PixelRatio.get();
    const ow = quantizeDecodePx(Math.round(gridTileWidth * dpr));
    const oh = quantizeDecodePx(Math.round(gridTileHeight * dpr));
    const out: GridCell[] = [];
    for (const story of stories) {
      const urls = storyMediaById.get(story.id) ?? [];
      urls.forEach((uri, mediaIndex) => {
        const optimized = getOptimizedImageUrl(uri, ow, oh, 72) || uri;
        const thumbFallbackUri = optimized !== uri ? uri : undefined;
        out.push({
          key: `${story.id}-${mediaIndex}`,
          storyId: story.id,
          mediaIndex,
          thumbUri: optimized,
          thumbFallbackUri,
        });
      });
    }
    return out;
  }, [stories, storyMediaById, gridTileWidth, gridTileHeight]);

  const handleGridCellPress = useCallback(
    (item: GridCell) => {
      void (async () => {
        const fullPayload = await ensureAllPagesLoaded();
        const allStories = fullPayload.stories;
        if (!allStories.length) return;
        const si = allStories.findIndex((story) => story.id === item.storyId);
        const safeIndex = si >= 0 ? si : 0;
        const placeId = allStories[safeIndex]?.place_id ?? "";
        openViewer(allStories, safeIndex, placeId, { [item.storyId]: item.mediaIndex });
      })();
    },
    [ensureAllPagesLoaded, openViewer],
  );

  const renderArchiveGridItem = useCallback<ListRenderItem<GridCell>>(
    (info) => (
      <StoryArchiveGridCell
        item={info.item}
        tileWidth={gridTileWidth}
        tileHeight={gridTileHeight}
        cardBackground={colors.card}
        onPressCell={handleGridCellPress}
      />
    ),
    [colors.card, gridTileHeight, gridTileWidth, handleGridCellPress],
  );

  useEffect(() => {
    if (!overlayActive || !stories.length || !gridItems.length || tab !== "grid") return;
    const viewportRows = Math.max(1, Math.ceil(tabBodyMinHeight / gridTileHeight));
    const preloadCount = Math.min(gridItems.length, (viewportRows + 2) * GRID_COLUMNS);
    const batch = Array.from(
      new Set(
        gridItems
          .slice(0, preloadCount)
          .flatMap((g) => [g.thumbUri, g.thumbFallbackUri].filter((u): u is string => Boolean(u))),
      ),
    );
    const task = InteractionManager.runAfterInteractions(() => {
      void preloadSmartImages(batch);
    });
    return () => task.cancel();
  }, [overlayActive, stories.length, gridItems, tabBodyMinHeight, gridTileHeight, tab]);

  const calThumbDecodePx = useMemo(() => {
    const dpr = Math.min(2, PixelRatio.get());
    return quantizeDecodePx(Math.round(CAL_CIRCLE_SIZE * dpr));
  }, []);

  const previewThumbByYmd = useMemo(() => {
    if (!overlayActive || !stories.length) return new Map<string, CalendarThumb>();
    const newestStoryByYmd = new Map<string, StoryItem>();
    for (const story of stories) {
      const ymd = toYmd(new Date(story.created_at));
      const prevNewest = newestStoryByYmd.get(ymd);
      if (!prevNewest || new Date(story.created_at).getTime() > new Date(prevNewest.created_at).getTime()) {
        newestStoryByYmd.set(ymd, story);
      }
    }
    const thumbs = new Map<string, CalendarThumb>();
    for (const [ymd, story] of newestStoryByYmd.entries()) {
      const raw = (storyMediaById.get(story.id) ?? [])[0];
      if (raw) thumbs.set(ymd, buildArchiveThumb(raw, calThumbDecodePx));
    }
    return thumbs;
  }, [overlayActive, stories, storyMediaById, calThumbDecodePx]);

  const storiesByYmd = useMemo(() => {
    if (tab !== "calendar") return new Map<string, StoryItem[]>();
    const byYmd = new Map<string, StoryItem[]>();
    for (const story of stories) {
      const ymd = toYmd(new Date(story.created_at));
      const list = byYmd.get(ymd) ?? [];
      list.push(story);
      byYmd.set(ymd, list);
    }
    for (const [ymd, list] of byYmd.entries()) {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      byYmd.set(ymd, list);
    }
    return byYmd;
  }, [tab, stories]);

  const monthCells = useMemo(() => {
    const y = visibleMonth.getFullYear();
    const mo = visibleMonth.getMonth();
    return buildMonthCellsMondayFirst(y, mo);
  }, [visibleMonth]);

  useEffect(() => {
    if (!overlayActive || !stories.length || tab !== "calendar") return;
    const uris: string[] = [];
    for (const cell of monthCells) {
      if (cell.kind !== "day") continue;
      const thumb = previewThumbByYmd.get(cell.ymd);
      if (!thumb) continue;
      uris.push(thumb.thumbUri);
      if (thumb.thumbFallbackUri) uris.push(thumb.thumbFallbackUri);
    }
    if (!uris.length) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void preloadSmartImagesBatched(uris);
    });
    return () => task.cancel();
  }, [overlayActive, stories.length, tab, monthCells, previewThumbByYmd]);

  const mapCoordsList = useMemo(() => {
    if (tab !== "map") return [] as Array<{ story: StoryItem; latitude: number; longitude: number }>;
    return stories
      .map((s: StoryItem) => {
        const c = coordsByStoryId[s.id];
        return c ? { story: s, ...c } : null;
      })
      .filter((x): x is { story: StoryItem; latitude: number; longitude: number } => x != null);
  }, [tab, stories, coordsByStoryId]);

  const clusterIndex = useMemo(() => {
    if (tab !== "map") return null;
    const idx = new Supercluster<ClusterPointProps>({
      radius: 56,
      maxZoom: 16,
      minZoom: 0,
      minPoints: 2,
    });
    const features = mapCoordsList.map(
      ({ story, latitude, longitude }: { story: StoryItem; latitude: number; longitude: number }) => ({
      type: "Feature" as const,
      properties: { storyId: story.id },
      geometry: { type: "Point" as const, coordinates: [longitude, latitude] as [number, number] },
    }));
    idx.load(features);
    return idx;
  }, [tab, mapCoordsList]);

  const storyById = useMemo(() => {
    const m = new Map<string, StoryItem>();
    for (const s of stories) m.set(s.id, s);
    return m;
  }, [stories]);

  const initialMapRegion = useMemo(() => {
    const coords = mapCoordsList.map((x: { story: StoryItem; latitude: number; longitude: number }) => ({ latitude: x.latitude, longitude: x.longitude }));
    return defaultRegionForCoords(coords);
  }, [mapCoordsList]);

  const mapProvider = PROVIDER_GOOGLE;

  const onMapRegionComplete = useCallback((region: Region) => {
    setMapRegion(region);
  }, []);

  const clustersForMap = useMemo(() => {
    if (!clusterIndex) return [] as MapClusterItem[];
    const region = mapRegion ?? initialMapRegion;
    const bbox: [number, number, number, number] = [
      region.longitude - region.longitudeDelta / 2,
      region.latitude - region.latitudeDelta / 2,
      region.longitude + region.longitudeDelta / 2,
      region.latitude + region.latitudeDelta / 2,
    ];
    const zoom = regionToZoom(region.longitudeDelta);
    return clusterIndex.getClusters(bbox, zoom);
  }, [clusterIndex, mapRegion, initialMapRegion]);

  const handleClusterPress = useCallback(
    (clusterId: number, coordinate: { latitude: number; longitude: number }) => {
      if (!clusterIndex) return;
      const z = clusterIndex.getClusterExpansionZoom(clusterId);
      const region = mapRegion ?? initialMapRegion;
      const nextDelta = 360 / Math.pow(2, z);
      mapRef.current?.animateToRegion({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: Math.max(region.latitudeDelta * 0.55, nextDelta * 0.8),
        longitudeDelta: Math.max(region.longitudeDelta * 0.55, nextDelta * 0.8),
      });
    },
    [clusterIndex, mapRegion, initialMapRegion],
  );

  const handleMapFeaturePress = useCallback(
    (feature: MapClusterItem) => {
      if (!clusterIndex) return;
      const coord = feature.geometry.coordinates;
      const latitude = coord[1];
      const longitude = coord[0];
      const props = feature.properties;
      if ("cluster" in props && props.cluster && props.cluster_id != null && (props.point_count ?? 0) >= 2) {
        const zoom = regionToZoom((mapRegion ?? initialMapRegion).longitudeDelta);
        const expansionZoom = clusterIndex.getClusterExpansionZoom(props.cluster_id);
        if (expansionZoom > zoom) {
          handleClusterPress(props.cluster_id, { latitude, longitude });
          return;
        }
        const leaves = clusterIndex.getLeaves(props.cluster_id, Infinity);
        const sorted = leaves
          .map((leaf: Supercluster.PointFeature<ClusterPointProps>) => storyById.get(leaf.properties.storyId))
          .filter((s): s is StoryItem => Boolean(s))
          .sort((a: StoryItem, b: StoryItem) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (sorted.length) openViewer(sorted, 0, sorted[0].place_id ?? "");
        return;
      }
      const sid = (props as ClusterPointProps).storyId;
      if (!sid) return;
      const story = storyById.get(sid);
      if (!story) return;
      openViewer([story], 0, story.place_id ?? "");
    },
    [clusterIndex, handleClusterPress, initialMapRegion, mapRegion, openViewer, storyById],
  );

  const styles = useStoriesArchiveStyles(insets.top);

  const renderGrid = () => {
    if (!gridItems.length) {
      return (
        <View style={{ minHeight: tabBodyMinHeight, justifyContent: "center", paddingHorizontal: 24 }}>
          <Text style={[styles.emptyText, { marginTop: 0 }]}>Archived stories have no images to show in the grid.</Text>
        </View>
      );
    }
    const initialRows = Math.max(4, Math.ceil(tabBodyMinHeight / gridTileHeight));
    const initialItems = initialRows * GRID_COLUMNS;
    return (
      <FlashList
        data={gridItems}
        keyExtractor={(item) => item.key}
        estimatedItemSize={gridTileHeight}
        numColumns={GRID_COLUMNS}
        style={{ flex: 1, minHeight: tabBodyMinHeight }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={initialItems}
        maxToRenderPerBatch={GRID_BATCH_ROWS * GRID_COLUMNS}
        windowSize={7}
        onEndReachedThreshold={0.55}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        renderItem={renderArchiveGridItem}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
      />
    );
  };

  const renderCalendar = () => {
    const y = visibleMonth.getFullYear();
    const mo = visibleMonth.getMonth();
    const monthLabel = visibleMonth.toLocaleString(undefined, { month: "long", year: "numeric" });
    const rows = chunkCells(monthCells, 7);

    return (
      <ScrollView
        style={{ flex: 1, minHeight: tabBodyMinHeight }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View style={styles.monthHeader}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setVisibleMonth(new Date(y, mo - 1, 1))}
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.monthTitle}>{monthLabel}</Text>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setVisibleMonth(new Date(y, mo + 1, 1))}
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.calRow}>
          {WEEKDAYS_MON.map((d) => (
            <View key={d} style={styles.calHeaderCell}>
              <Text style={styles.calWeekLabel}>{d}</Text>
            </View>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View style={styles.calRow} key={`cal-row-${ri}`}>
            {row.map((cell, ci) => {
              if (cell.kind === "pad") {
                return <View key={`pad-${ri}-${ci}`} style={styles.calDaySlot} />;
              }
              const dayStories = storiesByYmd.get(cell.ymd) ?? [];
              const thumb = previewThumbByYmd.get(cell.ymd) ?? null;
              return (
                <Pressable
                  key={cell.ymd}
                  style={styles.calDaySlot}
                  disabled={!dayStories.length}
                  onPress={() => {
                    const sorted = [...dayStories];
                    const placeId = sorted[0]?.place_id ?? "";
                    openViewer(sorted, 0, placeId);
                  }}
                >
                  {thumb ? (
                    <View style={styles.calCircle}>
                      <StoryArchiveGridThumb
                        uri={thumb.thumbUri}
                        fallbackUri={thumb.thumbFallbackUri}
                        recyclingKey={`cal-${cell.ymd}`}
                      />
                      <View
                        style={{
                          ...StyleSheet.absoluteFillObject,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "rgba(0,0,0,0.35)",
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{cell.day}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.calDayNum}>{cell.day}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderMap = () => {
    if (!mapCoordsList.length) {
      return (
        <View style={{ minHeight: tabBodyMinHeight, justifyContent: "center", paddingHorizontal: 24 }}>
          <Text style={[styles.emptyText, { marginTop: 0 }]}>No stories with a place location on the map.</Text>
        </View>
      );
    }
    return (
      <View style={{ flex: 1, minHeight: tabBodyMinHeight }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={mapProvider}
          initialRegion={initialMapRegion}
          onRegionChangeComplete={onMapRegionComplete}
        >
          {clustersForMap.map((f: MapClusterItem) => {
            const [lng, lat] = f.geometry.coordinates;
            const props = f.properties as ClusterPointProps & {
              cluster?: boolean;
              cluster_id?: number;
              point_count?: number;
            };
            const isCluster = Boolean(props.cluster) && props.cluster_id != null && (props.point_count ?? 0) >= 2;
            if (isCluster && props.cluster_id != null) {
              return (
                <ArchiveMapClusterMarker
                  key={`c-${props.cluster_id}`}
                  clusterId={props.cluster_id}
                  latitude={lat}
                  longitude={lng}
                  pointCount={props.point_count ?? 0}
                  bubbleStyle={styles.clusterBubble}
                  countTextStyle={styles.clusterCount}
                  onPress={() => handleMapFeaturePress(f)}
                />
              );
            }
            const sid = props.storyId;
            const story = sid ? storyById.get(sid) : undefined;
            const uri = story ? (storyMediaById.get(story.id) ?? [])[0] ?? null : null;
            return (
              <ArchiveMapStoryMarker
                key={`s-${sid ?? "x"}`}
                storyId={sid ?? "x"}
                latitude={lat}
                longitude={lng}
                thumbUri={uri}
                thumbStyle={styles.mapMarkerThumb}
                fallbackStyle={styles.mapMarkerThumbEmpty}
                onPress={() => handleMapFeaturePress(f)}
              />
            );
          })}
        </MapView>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]} {...archiveSwipeHandlers}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={onRequestClose} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Stories archive
        </Text>
        <Pressable style={styles.iconBtn} onPress={toggleThemeMode} accessibilityLabel="Toggle theme">
          <Ionicons name={mode === "dark" ? "sunny-outline" : "moon-outline"} size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        <Pressable style={styles.tabBtn} onPress={() => setTab("grid")}>
          <Ionicons name="apps-outline" size={22} color={tab === "grid" ? colors.primary : colors.textMuted} />
          {tab === "grid" ? <View style={styles.tabUnderline} /> : <View style={{ height: 8 }} />}
        </Pressable>
        <Pressable style={styles.tabBtn} onPress={() => setTab("calendar")}>
          <Ionicons name="calendar-outline" size={22} color={tab === "calendar" ? colors.primary : colors.textMuted} />
          {tab === "calendar" ? <View style={styles.tabUnderline} /> : <View style={{ height: 8 }} />}
        </Pressable>
        <Pressable style={styles.tabBtn} onPress={() => setTab("map")}>
          <Ionicons name="location-outline" size={22} color={tab === "map" ? colors.primary : colors.textMuted} />
          {tab === "map" ? <View style={styles.tabUnderline} /> : <View style={{ height: 8 }} />}
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : isError ? (
        <View style={{ padding: 16 }}>
          <Text style={styles.emptyText}>Could not load archive.</Text>
          <Pressable onPress={() => void refetch()} style={{ alignSelf: "center", marginTop: 12 }}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Retry</Text>
          </Pressable>
        </View>
      ) : !stories.length ? (
        <View style={{ minHeight: tabBodyMinHeight, justifyContent: "center", paddingHorizontal: 24 }}>
          <Text style={[styles.emptyText, { marginTop: 0 }]}>No stories older than 24 hours yet.</Text>
        </View>
      ) : (
        <View style={{ flex: 1, minHeight: tabBodyMinHeight, minWidth: "100%", position: "relative" }}>
          {isRefetching ? <ActivityIndicator style={{ position: "absolute", right: 16, top: 8, zIndex: 2 }} color={colors.primary} /> : null}
          {tab === "grid" ? <View style={[StyleSheet.absoluteFillObject, { zIndex: 2 }]}>{renderGrid()}</View> : null}
          {tab === "calendar" ? (
            <View style={[StyleSheet.absoluteFillObject, { zIndex: 2 }]}>{renderCalendar()}</View>
          ) : null}
          {tab === "map" ? <View style={[StyleSheet.absoluteFillObject, { zIndex: 2 }]}>{renderMap()}</View> : null}
        </View>
      )}
    </View>
  );
}
