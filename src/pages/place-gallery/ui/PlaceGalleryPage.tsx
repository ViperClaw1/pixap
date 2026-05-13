import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cancelAnimation, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import Carousel from "react-native-reanimated-carousel";
import type { BrowseFlowParamList } from "@/navigation/types";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { StoryProgressBar } from "@/components/stories/StoryProgressBar";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";

const AUTO_SLIDE_MS = 5000;

type PlaceGalleryRoute = RouteProp<BrowseFlowParamList, "PlaceGallery">;
type PlaceGalleryNav = NativeStackNavigationProp<BrowseFlowParamList, "PlaceGallery">;

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index, arr) => arr.indexOf(value) === index);
}

function isValidImageSource(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "null" || normalized === "undefined" || normalized === "nan") return false;
  if (normalized === "[object object]") return false;
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("file://") ||
    normalized.startsWith("content://") ||
    normalized.startsWith("data:image/") ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("/")
  );
}

export default function PlaceGalleryPage() {
  const { params } = useRoute<PlaceGalleryRoute>();
  const navigation = useNavigation<PlaceGalleryNav>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const images = useMemo(
    () => uniqueStrings(params.images.filter((item) => item.trim().length > 0 && isValidImageSource(item))),
    [params.images],
  );
  const rawImages = useMemo(
    () => uniqueStrings((params.rawImages ?? images).filter((item) => item.trim().length > 0 && isValidImageSource(item))),
    [images, params.rawImages],
  );
  const initialIndex = useMemo(() => {
    if (images.length === 0) return 0;
    return Math.max(0, Math.min(params.initialIndex ?? 0, images.length - 1));
  }, [images.length, params.initialIndex]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [paused, setPaused] = useState(false);
  const progress = useSharedValue(0);

  const restartProgress = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (paused || images.length <= 1) {
      progress.value = images.length <= 1 ? 1 : 0;
      return;
    }
    progress.value = withTiming(1, { duration: AUTO_SLIDE_MS, easing: Easing.linear });
  }, [images.length, paused, progress]);

  useEffect(() => {
    restartProgress();
    return () => {
      cancelAnimation(progress);
    };
  }, [activeIndex, paused, progress, restartProgress]);

  useEffect(() => {
    if (images.length === 0) navigation.goBack();
  }, [images.length, navigation]);

  return (
    <View style={styles.root}>
      <View style={styles.absoluteFill}>
        <Carousel
          width={width}
          height={height}
          data={images}
          loop
          autoPlay={images.length > 1}
          autoPlayInterval={AUTO_SLIDE_MS}
          enabled={!paused}
          defaultIndex={initialIndex}
          scrollAnimationDuration={500}
          onSnapToItem={setActiveIndex}
          renderItem={({ item, index }) => (
            <Pressable
              style={styles.absoluteFill}
              onLongPress={() => setPaused(true)}
              onPressOut={() => setPaused(false)}
              delayLongPress={220}
            >
              <SmartImage
                uri={getOptimizedImageUrl(rawImages[index] ?? item, 1280, 2200, 78) || rawImages[index] || item}
                fallbackUri={rawImages[index] ?? item}
                recyclingKey={`place-gallery-${index}`}
                style={styles.absoluteFill}
                contentFit="contain"
                transition={220}
              />
            </Pressable>
          )}
        />
      </View>

      <View style={[styles.topRow, { top: Math.max(8, insets.top + 8) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color="#111111" />
        </Pressable>
        <View style={styles.topProgressWrap}>
          <StoryProgressBar count={Math.max(1, images.length)} currentIndex={activeIndex} progress={progress} />
        </View>
        <View style={styles.rightSpacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  topRow: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topProgressWrap: {
    width: "70%",
    alignSelf: "center",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  rightSpacer: {
    width: 42,
    height: 42,
  },
});

