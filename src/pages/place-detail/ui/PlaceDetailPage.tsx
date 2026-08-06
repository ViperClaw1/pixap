import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  InteractionManager,
  Platform,
  View,
  Text,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { preloadSmartImages } from "@/shared/ui/smart-image/SmartImage";
import { useRoute, useNavigation, useIsFocused, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCard } from "@/entities/business-card";
import { isCategoryBookingAllowed } from "@/entities/category";
import { useReviews } from "@/entities/review";
import { useAuth } from "@/app/providers/AuthProvider";
import { useIsFavorite, useToggleFavorite } from "@/entities/favorite";
import { DirectionsModal } from "@/shared/ui/directions-modal";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { navigateToProfileAuth } from "@/app/navigation/navigationHelpers";
import { openPhoneDialer } from "@/shared/lib/openPhoneDialer";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { resolveBusinessCardHeroImagesRaw } from "@/shared/lib/business-card/businessCardImages";
import {
  getBusinessCardDisplayUrl,
  getBusinessCardDisplayUrls,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
import Carousel from "react-native-reanimated-carousel";
import { StoryBubblesRow } from "@/widgets/stories-strip";
import { useStories } from "@/entities/story";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { useDisableGestureDuringTransition } from "@/shared/lib/navigation/useDisableGestureDuringTransition";
import { useSubscriptionGatedNavigation } from "@/features/subscription-paywall-redirect";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import {
  HERO_OVERLAY_ICON_COLOR,
  PLACE_DETAIL_HERO_HEIGHT,
  placeDetailStaticStyles,
  placeDetailThemeStyles,
  resolveHeroSeeAllBadgeMaxWidth,
  resolveHeroSeeAllPhotosFontSize,
  resolvePlaceDetailStickyLayout,
} from "./placeDetailStyles";
import { ctaGradientColors, HERO_OVERLAY_GRADIENT } from "@/shared/theme/gradients";
import { StoryProgressBar } from "@/shared/ui/story-progress-bar";
import { StorySourcePickerModal } from "@/shared/ui/story-source-picker/StorySourcePickerModal";
import { useBatchStoryUpload } from "@/features/create-story";
import { StoryUploadProgressOverlay } from "@/shared/ui/story-upload-progress/StoryUploadProgressOverlay";
import { usePostShareSheet } from "@/features/post-share";
import { LiveCrowdCard, usePlaceCrowdCheckin, type CrowdCheckinOutcome } from "@/features/live-crowd-meter";
import { logCrowdCheckin } from "@/entities/venue-crowd";
import { appAlert } from "@/shared/ui/app-popup";
import { useTranslation } from "react-i18next";
import { ShareBottomSheet } from "@/shared/ui/share-bottom-sheet/ShareBottomSheet";
import { profileAvatarDisplay } from "@/pages/stories-feed/lib/feedPostHelpers";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type R = RouteProp<BrowseFlowParamList, "PlaceDetail">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "PlaceDetail">;
const AUTO_SLIDE_MS = 5000;
const DOUBLE_TAP_DELAY_MS = 260;

export default function PlaceDetailScreen() {
  const { id, hideBookingActions } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  useDisableGestureDuringTransition();
  const { openAIBooking, openBookingFlow } = useSubscriptionGatedNavigation(navigation);
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation, {
    sensitivity: "high",
  });
  const insets = useSafeAreaInsets();
  const isScreenFocused = useIsFocused();
  const { colors, isDark } = useAppTheme();
  const { data: place, isLoading } = useBusinessCard(id);
  const bookingActionsHidden =
    Boolean(hideBookingActions) || !isCategoryBookingAllowed(place?.category?.name);
  const { width: windowWidth } = useStaticWindowSize();
  const { data: reviews = [] } = useReviews(id);
  const {
    groupedStories,
    isLoading: storiesLoading,
    isError: storiesError,
    refetch: refetchStories,
  } = useStories(id);
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isFavorite = useIsFavorite(id);
  const toggleFavorite = useToggleFavorite();
  const shareSheet = usePostShareSheet();
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [storySourceModalVisible, setStorySourceModalVisible] = useState(false);
  const [shareStorySourceModalVisible, setShareStorySourceModalVisible] = useState(false);
  const storyUpload = useBatchStoryUpload(id);
  const shareStoryUpload = useBatchStoryUpload(id);
  const [heroSlide, setHeroSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [seenStoryIds, setSeenStoryIds] = useState<Record<string, true>>({});
  const [checkInRippleToken, setCheckInRippleToken] = useState(0);
  const progress = useSharedValue(0);
  const lastTapRef = useRef<{ at: number; index: number } | null>(null);
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const heroParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(scrollY.value, [0, 300], [0, -60], Extrapolation.CLAMP),
      },
    ],
  }));

  const crowdCheckin = usePlaceCrowdCheckin({
    venueId: id,
    venueLatitude: place?.latitude,
    venueLongitude: place?.longitude,
    isAuthenticated: Boolean(user?.id),
    autoOnMount: Boolean(place?.id),
  });

  useEffect(() => {
    if (!place) return;
    logCrowdCheckin("place_detail:venue_loaded", {
      venueId: place.id,
      name: place.name,
      address: place.address,
      latitude: place.latitude ?? null,
      longitude: place.longitude ?? null,
    });
  }, [place]);

  const presentCrowdCheckInOutcome = useCallback(
    (outcome: CrowdCheckinOutcome) => {
      if (outcome === "recorded") {
        setCheckInRippleToken((prev) => prev + 1);
        appAlert(t("crowd.checkInSuccess"), t("crowd.checkInSuccessMessage"), undefined, "success");
        return;
      }
      if (outcome === "location_denied") {
        appAlert(t("crowd.checkInFailed"), t("crowd.locationDenied"), undefined, "alert");
        return;
      }
      if (outcome === "too_far") {
        const devHint = __DEV__
          ? " [DEV] See [CrowdCheckin] logs in Metro."
          : "";
        appAlert(t("crowd.checkInFailed"), `${t("crowd.tooFar")}${devHint}`, undefined, "alert");
        return;
      }
      if (outcome === "rate_limited") {
        appAlert(t("crowd.alreadyCheckedIn"), t("crowd.alreadyCheckedInMessage"), undefined, "info");
        return;
      }
      if (outcome === "error") {
        appAlert(t("crowd.checkInFailed"), t("crowd.checkInError"), undefined, "alert");
      }
    },
    [t],
  );

  const openAuth = useCallback(() => {
    navigateToProfileAuth(navigation);
  }, [navigation]);

  const onCrowdCheckIn = useCallback(async () => {
    if (!user?.id) {
      openAuth();
      return;
    }
    if (crowdCheckin.isCheckingIn) return;

    const outcome = await crowdCheckin.checkInManual();
    if (outcome === "skipped") return;

    if (Platform.OS === "android") {
      InteractionManager.runAfterInteractions(() => presentCrowdCheckInOutcome(outcome));
      return;
    }
    presentCrowdCheckInOutcome(outcome);
  }, [crowdCheckin, openAuth, presentCrowdCheckInOutcome, user?.id]);

  const themed = useThemeStyles(({ colors: c, isDark: dark }) => placeDetailThemeStyles(c, dark));
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

  const onCall = useCallback(async () => {
    if (!place || isCalling) return;
    if (!place.phone) {
      Alert.alert("Unavailable", "Phone number not available");
      return;
    }
    setIsCalling(true);
    try {
      const result = await openPhoneDialer(place.phone);
      if (result === "invalid") {
        Alert.alert("Unavailable", "Phone number not available");
      } else if (result === "unavailable") {
        Alert.alert("Unavailable", "Could not open phone dialer");
      }
    } catch {
      Alert.alert("Unavailable", "Could not start call");
    } finally {
      setIsCalling(false);
    }
  }, [isCalling, place]);

  const heroTop = Math.max(insets.top, 12);
  const stickyLayout = useMemo(
    () => resolvePlaceDetailStickyLayout(insets.bottom),
    [insets.bottom],
  );
  const stickyBookingInset = hideBookingActions ? 0 : stickyLayout.barHeight;
  const bottomScrollPadding = stickyLayout.scrollTailPad + stickyBookingInset;

  const parallaxTranslateY = heroParallaxStyle;

  const storiesThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return groupedStories.reduce(
      (acc, group) =>
        acc +
        group.stories.filter((story) => new Date(story.created_at).getTime() >= weekAgo).length,
      0,
    );
  }, [groupedStories]);
  const imageVm = useMemo(() => {
    const { heroImagesRaw, heroFallback } = resolveBusinessCardHeroImagesRaw(place);
    const heroImages = getBusinessCardDisplayUrls(heroImagesRaw, { size: "hero" });
    const fallbackGalleryImages = heroFallback ? [heroFallback] : [];
    const galleryRaw = heroImagesRaw.length > 0 ? heroImagesRaw : fallbackGalleryImages;
    return {
      heroImagesRaw,
      heroImages,
      heroFallback: heroFallback ? getBusinessCardDisplayUrl(heroFallback, { size: "hero" }) : null,
      galleryImages: galleryRaw,
      galleryFallbacks: galleryRaw,
      gridThumbImages: getBusinessCardDisplayUrls(galleryRaw, { size: "list" }),
    };
  }, [place]);

  const heroSeeAllPhotos = useMemo(() => {
    const count = imageVm.heroImages.length;
    if (count < 2) return null;
    const label = t("placeDetail.seeAllPhotos", { count });
    const maxWidth = resolveHeroSeeAllBadgeMaxWidth(windowWidth);
    return {
      label,
      maxWidth,
      fontSize: resolveHeroSeeAllPhotosFontSize(label, maxWidth),
      a11yLabel: t("placeDetail.seeAllPhotosA11y", { count }),
    };
  }, [i18n.language, imageVm.heroImages.length, t, windowWidth]);

  const onShare = useCallback(() => {
    if (!place) return;
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    shareSheet.openShareForPlace({
      placeId: place.id,
      placeName: place.name,
      images: imageVm.heroImagesRaw,
      storyId: shareSheet.shareStoryId,
    });
  }, [imageVm.heroImagesRaw, navigation, place, shareSheet, user]);

  const shareStoryTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);

  useEffect(() => {
    return () => shareStoryTaskRef.current?.cancel();
  }, []);

  const onShareAddToStory = useCallback(async () => {
    if (shareSheet.shareOnlyPlaceId && !shareSheet.sharePostId) {
      shareSheet.resetShareState();
      shareStoryTaskRef.current?.cancel();
      shareStoryTaskRef.current = InteractionManager.runAfterInteractions(() => {
        setShareStorySourceModalVisible(true);
      });
      return;
    }
    await shareSheet.handleShareToStory(navigation);
  }, [navigation, shareSheet]);

  const onShareStorySourceChoose = useCallback(
    async (source: "camera" | "gallery") => {
      setShareStorySourceModalVisible(false);
      const createdStoryId = await shareStoryUpload.onChooseStorySource(source);
      if (!createdStoryId || !place) return;
      shareSheet.attachShareStoryId(createdStoryId);
      shareSheet.openShareForPlace({
        placeId: place.id,
        placeName: place.name,
        images: imageVm.heroImagesRaw,
        storyId: createdStoryId,
      });
    },
    [imageVm.heroImagesRaw, place, shareSheet, shareStoryUpload],
  );

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
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    const timer = setTimeout(() => {
      task = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) void preloadSmartImages(preloadCandidates);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [imageVm.heroImages]);

  const openFullscreenGallery = useCallback(
    (initialIndex: number) => {
      navigation.navigate("PlaceGallery", {
        placeId: id,
        images: imageVm.galleryImages,
        rawImages: imageVm.galleryFallbacks,
        initialIndex,
      });
    },
    [id, imageVm.galleryFallbacks, imageVm.galleryImages, navigation],
  );

  const openPhotoGrid = useCallback(() => {
    if (!place) return;
    navigation.navigate("PlacePhotoGrid", {
      placeId: place.id,
      title: place.name,
      images: imageVm.gridThumbImages,
      rawImages: imageVm.galleryFallbacks,
    });
  }, [imageVm.galleryFallbacks, imageVm.gridThumbImages, navigation, place]);

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

  const renderHeroItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <AppPressable
        onPress={() => handleHeroTap(index)}
        onLongPress={() => setHeroPaused(true)}
        onPressOut={() => setHeroPaused(false)}
        delayLongPress={220}
      >
        <SmartImage
          uri={item}
          fallbackUri={imageVm.heroImagesRaw[index] ?? null}
          recyclingKey={`${place?.id ?? "place"}-hero-${index}`}
          style={styles.hero}
          contentFit="cover"
          showLoadingSpinner
          skipBundledPlaceholder
          loadingSpinnerColor={colors.primary}
        />
      </AppPressable>
    ),
    [colors.primary, handleHeroTap, imageVm.heroImagesRaw, place?.id, styles.hero],
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
    <Animated.ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: bottomScrollPadding }}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
    >
      <View style={[styles.heroWrap, { backgroundColor: colors.card }]}>
        <Animated.View style={[styles.heroMediaLayer, parallaxTranslateY]}>
          {imageVm.heroImages.length > 1 ? (
            <>
              <Carousel
                width={windowWidth}
                height={PLACE_DETAIL_HERO_HEIGHT}
                data={imageVm.heroImages}
                loop
                autoPlay={isScreenFocused && imageVm.heroImages.length > 1}
                autoPlayInterval={AUTO_SLIDE_MS}
                enabled={!heroPaused}
                scrollAnimationDuration={500}
                onSnapToItem={setHeroSlide}
                renderItem={renderHeroItem}
              />
              <View style={[styles.heroProgressWrap, { top: heroTop }]}>
                <StoryProgressBar count={imageVm.heroImages.length} currentIndex={heroSlide} progress={progress} />
              </View>
            </>
          ) : (
            <AppPressable
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
                showLoadingSpinner
                skipBundledPlaceholder
                loadingSpinnerColor={colors.primary}
              />
            </AppPressable>
          )}
        </Animated.View>

        <LinearGradient
          colors={[...HERO_OVERLAY_GRADIENT]}
          style={styles.heroGradient}
          pointerEvents="none"
        />

        <View style={styles.heroFooter} pointerEvents="box-none">
          {imageVm.heroImages.length > 1 ? (
            <View style={styles.heroDotsRow} pointerEvents="none">
              {imageVm.heroImages.map((_, idx) => (
                <View
                  key={`${place.id}-hero-dot-${idx}`}
                  style={[styles.heroDot, heroSlide === idx && styles.heroDotActive]}
                />
              ))}
            </View>
          ) : null}
          <View style={styles.heroInfoRow}>
            <View style={styles.heroInfoText} pointerEvents="none">
              <Text style={styles.heroTitle} numberOfLines={2}>
                {place.name}
              </Text>
              <Text style={styles.heroRating}>
                {Number(place.rating).toFixed(1)} ({reviews.length}{" "}
                {t("placeDetail.reviews", { defaultValue: "reviews" })})
              </Text>
            </View>
            {heroSeeAllPhotos ? (
              <AppPressable
                style={[styles.heroSeeAllBadge, { maxWidth: heroSeeAllPhotos.maxWidth }]}
                onPress={openPhotoGrid}
                accessibilityRole="button"
                accessibilityLabel={heroSeeAllPhotos.a11yLabel}
              >
                <Text
                  style={[styles.heroSeeAllBadgeText, { fontSize: heroSeeAllPhotos.fontSize }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {heroSeeAllPhotos.label}
                </Text>
              </AppPressable>
            ) : null}
          </View>
        </View>

        {storiesThisWeek > 0 ? (
          <View style={[styles.heroStoriesBadge, { top: heroTop + 52 }]} pointerEvents="none">
            <Text style={styles.heroStoriesBadgeText}>
              {t("placeDetail.storiesThisWeek", {
                count: storiesThisWeek,
                defaultValue: "{{count}} stories this week",
              })}
            </Text>
          </View>
        ) : null}

        <View style={[styles.heroBar, { top: heroTop + 8 }]}>
          <AppPressable style={styles.heroBackBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={20} color={HERO_OVERLAY_ICON_COLOR} />
          </AppPressable>
          <View style={styles.heroBarActions}>
            <AppPressable style={styles.iconBtn} onPress={() => setDirectionsOpen(true)} accessibilityLabel={t("placeDetail.directions")}>
              <Ionicons name="navigate-outline" size={18} color={HERO_OVERLAY_ICON_COLOR} />
            </AppPressable>
            <AppPressable style={styles.iconBtn} onPress={onShare} accessibilityLabel="Share">
              <Ionicons name="share-outline" size={18} color={HERO_OVERLAY_ICON_COLOR} />
            </AppPressable>
            <AppPressable style={styles.iconBtn} onPress={onFavorite} accessibilityLabel="Favorite">
              <Text style={[styles.iconBtnText, { color: HERO_OVERLAY_ICON_COLOR }]}>{isFavorite ? "♥" : "♡"}</Text>
            </AppPressable>
          </View>
        </View>
      </View>

      <View style={[styles.card, Platform.OS === "android" ? styles.cardAndroid : null]}>
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
        <LiveCrowdCard
          venueId={place.id}
          enabled={isScreenFocused}
          onCardPress={user?.id ? undefined : openAuth}
          onCheckIn={() => void onCrowdCheckIn()}
          isCheckingIn={crowdCheckin.isCheckingIn}
          checkInRippleToken={checkInRippleToken}
          crowdCardStyle={styles.crowdCard}
          crowdBadgeStyle={styles.crowdBadge}
          crowdTitleStyle={styles.crowdTitle}
          crowdHeadlineStyle={styles.crowdHeadline}
          crowdMetaStyle={styles.crowdMeta}
          crowdCheckInBtnStyle={styles.crowdCheckInBtn}
          crowdCheckInTextStyle={styles.crowdCheckInText}
        />

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
          <AppPressable
            style={[styles.callBtn, isCalling && { opacity: 0.65 }]}
            onPress={() => void onCall()}
            disabled={isCalling}
            accessibilityState={{ disabled: isCalling, busy: isCalling }}
          >
            {isCalling ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <>
                <Ionicons name="call-outline" size={16} color={colors.accent} />
                <Text style={styles.callBtnText}>{t("placeDetail.call")}</Text>
              </>
            )}
          </AppPressable>
          <AppPressable style={styles.directionsBtn} onPress={() => setDirectionsOpen(true)}>
            <Ionicons name="navigate-outline" size={16} color={colors.link} />
            <Text style={styles.directionsBtnText}>{t("placeDetail.directions")}</Text>
          </AppPressable>
        </View>

        {/* <AppPressable style={styles.outlineBtn} onPress={() => navigation.navigate("ShoppingItems", { id: place.id })}>
          <Text style={styles.outlineBtnText}>Order items</Text>
        </AppPressable> */}
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
          void storyUpload.onChooseStorySource(source);
        }}
      />

      <StorySourcePickerModal
        visible={shareStorySourceModalVisible}
        onClose={() => setShareStorySourceModalVisible(false)}
        onChoose={(source) => {
          void onShareStorySourceChoose(source);
        }}
      />

      <StoryUploadProgressOverlay visible={shareStoryUpload.uploadingStory} stage={shareStoryUpload.uploadStage} />

      <ShareBottomSheet
        visible={shareSheet.shareVisible}
        onClose={shareSheet.resetShareState}
        users={shareSheet.shareUsers}
        loading={shareSheet.shareUsersLoading}
        searchValue={shareSheet.shareSearch}
        onChangeSearch={shareSheet.setShareSearch}
        resolveAvatarUri={profileAvatarDisplay}
        sharePostId={shareSheet.sharePostId}
        sharePlaceId={shareSheet.shareOnlyPlaceId}
        shareStoryId={shareSheet.shareStoryId}
        sharePostHasMedia={shareSheet.sharePostImages.length > 0}
        sharePlaceName={shareSheet.sharePlaceName}
        shareSending={shareSheet.shareSending}
        sheetAlert={shareSheet.shareAlert}
        onDismissSheetAlert={shareSheet.dismissShareAlert}
        onShowSheetAlert={shareSheet.showShareAlertOptions}
        onAddToStory={onShareAddToStory}
        onWhatsAppShare={shareSheet.handleShareToWhatsapp}
        onSystemShare={shareSheet.handleSystemShare}
        onCopyLink={shareSheet.handleCopyPostLink}
      />
    </Animated.ScrollView>

      {!bookingActionsHidden ? (
        <View
          style={[
            styles.stickyBookingBar,
            {
              paddingTop: stickyLayout.topPad,
              paddingBottom: stickyLayout.bottomPad,
            },
          ]}
        >
          <AppPressable style={styles.stickyPrimaryBtn} onPress={() => openBookingFlow({ id: place.id })}>
            <Text style={styles.stickyPrimaryBtnText}>{t("placeDetail.bookNow")}</Text>
          </AppPressable>
          <AppPressable style={styles.stickyBtnWrap} onPress={() => openAIBooking({ id: place.id })}>
            <LinearGradient
              colors={[...ctaGradientColors(isDark)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.stickyPixAIBtn}
            >
              <Ionicons name="sparkles-outline" size={16} color="#ffffff" style={styles.stickyPixAIBtnIcon} />
              <Text style={styles.stickyPixAIBtnText}>{t("placeDetail.bookWithPixAI")}</Text>
            </LinearGradient>
          </AppPressable>
        </View>
      ) : null}
    </View>
  );
}
