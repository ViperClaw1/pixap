import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  useWindowDimensions,
} from "react-native";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { preloadSmartImages } from "@/shared/ui/smart-image/SmartImage";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCard } from "@/entities/business-card";
import { useReviews } from "@/entities/review";
import { useAuth } from "@/app/providers/AuthProvider";
import { useIsFavorite, useToggleFavorite } from "@/entities/favorite";
import { DirectionsModal } from "@/shared/ui/directions-modal";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { navigateToProfileAuth } from "@/app/navigation/navigationHelpers";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { resolveBusinessCardHeroImagesRaw } from "@/shared/lib/business-card/businessCardImages";
import Carousel from "react-native-reanimated-carousel";
import { StoryBubblesRow } from "@/widgets/stories-strip";
import { useStories } from "@/entities/story";
import {
  SHARED_PRESSABLE_HEIGHT,
  SHARED_PRESSABLE_RADIUS,
  primaryPressableStyle,
  primaryPressableTextStyle,
} from "@/shared/theme/primaryPressable";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { useSubscriptionGatedNavigation } from "@/features/subscription-paywall-redirect";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { placeDetailStaticStyles, placeDetailThemeStyles } from "./placeDetailStyles";
import { StoryProgressBar } from "@/shared/ui/story-progress-bar";
import { StorySourcePickerModal } from "@/shared/ui/story-source-picker/StorySourcePickerModal";
import { useBatchStoryUpload } from "@/features/create-story";
import { Easing, cancelAnimation, useSharedValue, withTiming } from "react-native-reanimated";

type R = RouteProp<BrowseFlowParamList, "PlaceDetail">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "PlaceDetail">;
const AUTO_SLIDE_MS = 5000;
const DOUBLE_TAP_DELAY_MS = 260;

export default function PlaceDetailScreen() {
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  const { openAIBooking } = useSubscriptionGatedNavigation(navigation);
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
  const [storySourceModalVisible, setStorySourceModalVisible] = useState(false);
  const storyUpload = useBatchStoryUpload(id);
  const [heroSlide, setHeroSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [seenStoryIds, setSeenStoryIds] = useState<Record<string, true>>({});
  const progress = useSharedValue(0);
  const lastTapRef = useRef<{ at: number; index: number } | null>(null);

  const themed = useThemeStyles(({ colors: c }) => placeDetailThemeStyles(c));
  const styles = useMemo(
    () => mergeStaticAndThemed(placeDetailStaticStyles, themed),
    [themed],
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

  const openAddStoryFlow = useCallback(() => {
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    if (storyUpload.uploadingStory) return;
    setStorySourceModalVisible(true);
  }, [navigation, storyUpload.uploadingStory, user]);

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
    const { heroImagesRaw, heroFallback } = resolveBusinessCardHeroImagesRaw(place);
    // For place hero we intentionally keep deterministic public object URLs.
    // Supabase render endpoint can revalidate more often and trigger network hits on re-entry.
    const heroImages = heroImagesRaw;
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
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root} {...androidSwipeBackPanHandlers}>
    <ScrollView
      style={styles.root}
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
                    bundledFallback={PLACE_IMAGE_FALLBACK}
                    recyclingKey={`${place.id}-hero-${index}`}
                    style={styles.hero}
                    contentFit="cover"
                    transition={200}
                  />
                </Pressable>
              )}
            />
            <View style={[styles.heroProgressWrap, { top: heroTop }]}>
              <StoryProgressBar count={imageVm.heroImages.length} currentIndex={heroSlide} progress={progress} />
            </View>
            <View style={styles.heroDotsRow}>
              {imageVm.heroImages.map((_, idx) => (
                <View key={`${place.id}-hero-dot-${idx}`} style={[styles.heroDot, heroSlide === idx && styles.heroDotActive]} />
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
              bundledFallback={PLACE_IMAGE_FALLBACK}
              recyclingKey={place.id}
              style={styles.hero}
              contentFit="cover"
            />
          </Pressable>
        )}
        <View style={[styles.heroBar, { top: heroTop + 18 }]}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={onFavorite}>
            <Text style={styles.iconBtnText}>{isFavorite ? "♥" : "♡"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <StoryBubblesRow
          groups={groupedStories}
          seenStoryIds={seenStoryIds}
          onPressGroup={openStoryGroup}
          onPressAddStory={openAddStoryFlow}
          uploadingAddStory={storyUpload.uploadingStory}
          loading={storiesLoading}
          isError={storiesError}
          onRetry={() => void refetchStories()}
        />
        <Text style={styles.title}>{place.name}</Text>
        <Text style={styles.rating}>
          {Number(place.rating).toFixed(1)} ({reviews.length} reviews)
        </Text>
        <View style={styles.tags}>
          {place.tags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              {tag}
            </Text>
          ))}
        </View>
        <Text style={styles.desc}>{place.description}</Text>
        <Text style={styles.addr}>📍 {place.address}</Text>

        <View style={styles.actions}>
          <Pressable style={styles.secondaryBtn} onPress={onCall}>
            <Text style={styles.secondaryBtnText}>Call</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => setDirectionsOpen(true)}>
            <Text style={styles.secondaryBtnText}>Directions</Text>
          </Pressable>
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate("BookingFlow", { id: place.id })}>
          <Text style={styles.primaryBtnText}>Book now</Text>
        </Pressable>
        <Pressable style={styles.outlineBtn} onPress={() => openAIBooking({ id: place.id })}>
          <Text style={styles.outlineBtnText}>Book with PixAI</Text>
        </Pressable>
        {/* <Pressable style={styles.outlineBtn} onPress={() => navigation.navigate("ShoppingItems", { id: place.id })}>
          <Text style={styles.outlineBtnText}>Order items</Text>
        </Pressable> */}
      </View>

      <DirectionsModal
        visible={directionsOpen}
        onClose={() => setDirectionsOpen(false)}
        placeName={place.name}
        address={place.address}
      />

      <StorySourcePickerModal
        visible={storySourceModalVisible}
        onClose={() => setStorySourceModalVisible(false)}
        onChoose={(source) => {
          setStorySourceModalVisible(false);
          storyUpload.onChooseStorySource(source);
        }}
      />
    </ScrollView>
    </View>
  );
}
