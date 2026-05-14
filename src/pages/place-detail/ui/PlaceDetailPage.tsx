import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  useWindowDimensions,
} from "react-native";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { preloadSmartImages } from "@/shared/ui/smart-image/SmartImage";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCard } from "@/entities/business-card";
import { useReviews } from "@/entities/review";
import { useAuth } from "@/contexts/AuthContext";
import { useIsFavorite, useToggleFavorite } from "@/entities/favorite";
import { DirectionsModal } from "@/components/DirectionsModal";
import type { BrowseFlowParamList } from "@/navigation/types";
import { navigateToProfileAuth } from "@/navigation/navigationHelpers";
import { useAppTheme } from "@/contexts/ThemeContext";
import { getLatestBusinessCardImage, normalizeBusinessCardImages } from "@/lib/businessCardImages";
import Carousel from "react-native-reanimated-carousel";
import { StoryBubblesRow } from "@/components/stories/StoryBubblesRow";
import { useStories } from "@/entities/story";
import {
  SHARED_PRESSABLE_HEIGHT,
  SHARED_PRESSABLE_RADIUS,
  primaryPressableStyle,
  primaryPressableTextStyle,
} from "@/shared/theme/primaryPressable";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { StoryProgressBar } from "@/components/stories/StoryProgressBar";
import { Easing, cancelAnimation, useSharedValue, withTiming } from "react-native-reanimated";

type R = RouteProp<BrowseFlowParamList, "PlaceDetail">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "PlaceDetail">;
const AUTO_SLIDE_MS = 5000;
const DOUBLE_TAP_DELAY_MS = 260;

export default function PlaceDetailScreen() {
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { data: place, isLoading } = useBusinessCard(id);
  const { width: windowWidth } = useWindowDimensions();
  const { data: reviews = [] } = useReviews(id);
  const {
    groupedStories,
    isLoading: storiesLoading,
    isError: storiesError,
    refetch: refetchStories,
  } = useStories(id);
  const { user } = useAuth();
  const isFavorite = useIsFavorite(id);
  const toggleFavorite = useToggleFavorite();
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [seenStoryIds, setSeenStoryIds] = useState<Record<string, true>>({});
  const progress = useSharedValue(0);
  const lastTapRef = useRef<{ at: number; index: number } | null>(null);

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, justifyContent: "center", alignItems: "center" },
        heroBar: {
          position: "absolute",
          left: 16,
          right: 16,
          flexDirection: "row",
          justifyContent: "space-between",
          zIndex: 5,
        },
        iconBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "rgba(255,255,255,0.92)",
          alignItems: "center",
          justifyContent: "center",
        },
        iconBtnText: { fontSize: 18, color: "#111" },
        heroProgressWrap: {
          position: "absolute",
          left: 16,
          right: 16,
          zIndex: 6,
        },
        heroDotsRow: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 10,
          flexDirection: "row",
          justifyContent: "center",
          gap: 6,
        },
        heroDot: {
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: "rgba(255,255,255,0.45)",
        },
        heroDotActive: {
          backgroundColor: "rgba(255,255,255,0.95)",
        },
        card: {
          marginTop: -24,
          backgroundColor: colors.background,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          borderWidth: 0,
          borderColor: colors.background,
        },
        title: { fontSize: 22, fontWeight: "800", color: colors.text },
        rating: { marginTop: 6, color: colors.textMuted, fontSize: 14 },
        tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
        tag: {
          fontSize: 12,
          backgroundColor: colors.border,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          color: colors.text,
        },
        desc: { marginTop: 16, color: colors.textMuted, lineHeight: 22 },
        addr: { marginTop: 12, color: colors.text },
        actions: { flexDirection: "row", gap: 10, marginTop: 16 },
        secondaryBtn: {
          flex: 1,
          minHeight: SHARED_PRESSABLE_HEIGHT,
          borderRadius: SHARED_PRESSABLE_RADIUS,
          backgroundColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        secondaryBtnText: { fontWeight: "600", color: colors.text },
        primaryBtn: {
          marginTop: 16,
          ...primaryPressableStyle,
        },
        primaryBtnText: primaryPressableTextStyle,
        outlineBtn: {
          marginTop: 10,
          minHeight: SHARED_PRESSABLE_HEIGHT,
          borderRadius: SHARED_PRESSABLE_RADIUS,
          borderWidth: 1,
          borderColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        outlineBtnText: { fontWeight: "700", color: colors.primary },
      }),
    [colors],
  );

  const openStoryGroup = useCallback(
    (groupIndex: number) => {
      const targetGroup = groupedStories[groupIndex];
      if (!targetGroup?.stories.length) return;

      const firstUnseenIndex = targetGroup.stories.findIndex((story) => !seenStoryIds[story.id]);
      const initialStoryIndex = firstUnseenIndex >= 0 ? firstUnseenIndex : 0;

      setSeenStoryIds((prev) => {
        const next = { ...prev };
        for (const story of targetGroup.stories) {
          next[story.id] = true;
        }
        return next;
      });

      navigation.navigate("FeedStoryViewer", {
        groups: groupedStories,
        initialGroupIndex: groupIndex,
        initialStoryIndex,
        placeId: targetGroup.stories[initialStoryIndex]?.place_id ?? id,
      });
    },
    [groupedStories, id, navigation, seenStoryIds],
  );

  const openStoryComposer = useCallback(() => {
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    navigation.navigate("StoryComposer", { placeId: id });
  }, [id, navigation, user]);

  const onFavorite = () => {
    if (!place) return;
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    toggleFavorite.mutate({ businessCardId: place.id, isFavorite });
  };

  const onCall = () => {
    if (!place) return;
    if (!place.phone) {
      Alert.alert("Unavailable", "Phone number not available");
      return;
    }
    void Linking.openURL(`tel:${place.phone}`);
  };

  const heroTop = Math.max(insets.top, 12);
  const bottomScrollPadding = Platform.OS === "ios" ? Math.max(insets.bottom, 24) : 20;
  const imageVm = useMemo(() => {
    const legacyImage = (place as unknown as { image?: string | null } | null)?.image;
    const normalizedImageList = normalizeBusinessCardImages(place?.images);
    const heroImagesRaw =
      normalizedImageList.length > 0
        ? normalizedImageList
        : [...normalizedImageList, ...normalizeBusinessCardImages(legacyImage)].filter(
            (url, idx, arr) => arr.indexOf(url) === idx,
          );
    // For place hero we intentionally keep deterministic public object URLs.
    // Supabase render endpoint can revalidate more often and trigger network hits on re-entry.
    const heroImages = heroImagesRaw;
    const heroFallback = getLatestBusinessCardImage(place?.images) ?? getLatestBusinessCardImage(legacyImage);
    const fallbackGalleryImages = heroFallback ? [heroFallback] : [];
    return {
      heroImagesRaw,
      heroImages,
      heroFallback,
      galleryImages: heroImagesRaw.length > 0 ? heroImagesRaw : fallbackGalleryImages,
      galleryFallbacks: heroImages.length > 0 ? heroImages : fallbackGalleryImages,
    };
  }, [place]);

  const restartHeroProgress = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (heroPaused || imageVm.heroImages.length <= 1) {
      progress.value = imageVm.heroImages.length <= 1 ? 1 : 0;
      return;
    }
    progress.value = withTiming(1, { duration: AUTO_SLIDE_MS, easing: Easing.linear });
  }, [heroPaused, imageVm.heroImages.length, progress]);

  useEffect(() => {
    restartHeroProgress();
    return () => cancelAnimation(progress);
  }, [heroSlide, heroPaused, progress, restartHeroProgress]);

  useEffect(() => {
    const preloadCandidates = imageVm.heroImages.slice(0, 4);
    if (!preloadCandidates.length) return;
    void preloadSmartImages(preloadCandidates);
  }, [imageVm.heroImages]);

  const openFullscreenGallery = useCallback(
    (initialIndex: number) => {
      navigation.navigate("PlaceGallery", {
        images: imageVm.galleryImages,
        rawImages: imageVm.galleryFallbacks,
        initialIndex,
      });
    },
    [imageVm.galleryFallbacks, imageVm.galleryImages, navigation],
  );

  const handleHeroTap = useCallback(
    (index: number) => {
      const now = Date.now();
      const prev = lastTapRef.current;
      if (prev && prev.index === index && now - prev.at <= DOUBLE_TAP_DELAY_MS) {
        lastTapRef.current = null;
        openFullscreenGallery(index);
        return;
      }
      lastTapRef.current = { at: now, index };
    },
    [openFullscreenGallery],
  );

  if (isLoading || !place) {
    return (
      <View style={[stylesThemed.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={stylesThemed.root} {...androidSwipeBackPanHandlers}>
    <ScrollView
      style={stylesThemed.root}
      contentContainerStyle={{ paddingBottom: bottomScrollPadding }}
    >
      <View>
        {imageVm.heroImages.length > 1 ? (
          <>
            <Carousel
              width={windowWidth}
              height={280}
              data={imageVm.heroImages}
              loop
              autoPlay={imageVm.heroImages.length > 1}
              autoPlayInterval={AUTO_SLIDE_MS}
              enabled={!heroPaused}
              scrollAnimationDuration={500}
              onSnapToItem={setHeroSlide}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => handleHeroTap(index)}
                  onLongPress={() => setHeroPaused(true)}
                  onPressOut={() => setHeroPaused(false)}
                  delayLongPress={220}
                >
                  <SmartImage
                    uri={item}
                    fallbackUri={imageVm.heroImagesRaw[index] ?? null}
                    recyclingKey={`${place.id}-hero-${index}`}
                    style={styles.hero}
                    contentFit="cover"
                    transition={200}
                  />
                </Pressable>
              )}
            />
            <View style={[stylesThemed.heroProgressWrap, { top: heroTop }]}>
              <StoryProgressBar count={imageVm.heroImages.length} currentIndex={heroSlide} progress={progress} />
            </View>
            <View style={stylesThemed.heroDotsRow}>
              {imageVm.heroImages.map((_, idx) => (
                <View key={`${place.id}-hero-dot-${idx}`} style={[stylesThemed.heroDot, heroSlide === idx && stylesThemed.heroDotActive]} />
              ))}
            </View>
          </>
        ) : (
          <Pressable
            onPress={() => handleHeroTap(0)}
            onLongPress={() => setHeroPaused(true)}
            onPressOut={() => setHeroPaused(false)}
            delayLongPress={220}
          >
            <SmartImage
              uri={imageVm.heroImages[0] ?? imageVm.heroFallback}
              fallbackUri={imageVm.heroImagesRaw[0] ?? null}
              recyclingKey={place.id}
              style={styles.hero}
              contentFit="cover"
            />
          </Pressable>
        )}
        <View style={[stylesThemed.heroBar, { top: heroTop + 18 }]}>
          <Pressable style={stylesThemed.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={stylesThemed.iconBtnText}>←</Text>
          </Pressable>
          <Pressable style={stylesThemed.iconBtn} onPress={onFavorite}>
            <Text style={stylesThemed.iconBtnText}>{isFavorite ? "♥" : "♡"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={stylesThemed.card}>
        <StoryBubblesRow
          groups={groupedStories}
          seenStoryIds={seenStoryIds}
          onPressGroup={openStoryGroup}
          onPressAddStory={openStoryComposer}
          loading={storiesLoading}
          isError={storiesError}
          onRetry={() => void refetchStories()}
        />
        <Text style={stylesThemed.title}>{place.name}</Text>
        <Text style={stylesThemed.rating}>
          {Number(place.rating).toFixed(1)} ({reviews.length} reviews)
        </Text>
        <View style={stylesThemed.tags}>
          {place.tags.map((tag) => (
            <Text key={tag} style={stylesThemed.tag}>
              {tag}
            </Text>
          ))}
        </View>
        <Text style={stylesThemed.desc}>{place.description}</Text>
        <Text style={stylesThemed.addr}>📍 {place.address}</Text>

        <View style={stylesThemed.actions}>
          <Pressable style={stylesThemed.secondaryBtn} onPress={onCall}>
            <Text style={stylesThemed.secondaryBtnText}>Call</Text>
          </Pressable>
          <Pressable style={stylesThemed.secondaryBtn} onPress={() => setDirectionsOpen(true)}>
            <Text style={stylesThemed.secondaryBtnText}>Directions</Text>
          </Pressable>
        </View>

        <Pressable style={stylesThemed.primaryBtn} onPress={() => navigation.navigate("BookingFlow", { id: place.id })}>
          <Text style={stylesThemed.primaryBtnText}>Book now</Text>
        </Pressable>
        <Pressable style={stylesThemed.outlineBtn} onPress={() => navigation.navigate("AIBooking", { id: place.id })}>
          <Text style={stylesThemed.outlineBtnText}>Book with PixAI</Text>
        </Pressable>
        {/* <Pressable style={stylesThemed.outlineBtn} onPress={() => navigation.navigate("ShoppingItems", { id: place.id })}>
          <Text style={stylesThemed.outlineBtnText}>Order items</Text>
        </Pressable> */}
      </View>

      <DirectionsModal
        visible={directionsOpen}
        onClose={() => setDirectionsOpen(false)}
        placeName={place.name}
        address={place.address}
      />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", height: 280 },
});
