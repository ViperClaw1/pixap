import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  PixelRatio,
  InteractionManager,
  useWindowDimensions
} from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useBusinessCards,
  type BusinessCard,
} from "@/entities/business-card";
import { useCategories, CategoryIcon, resolveCategoryIconSpec, localizeCategoryName } from "@/entities/category";
import { useUnreadCount } from "@/entities/notification";
import {
  useDailyRecommendations,
  useTrackRecommendationEvent,
  useTrackRecommendationInteraction,
} from "@/entities/daily-recommendation";
import type { HomeStackParamList, RootTabParamList } from "@/app/navigation/types";
import { navigateToProfileAuth } from "@/app/navigation/navigationHelpers";
import { useAuth } from "@/app/providers/AuthProvider";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import { useProfile } from "@/entities/user";
import ThemeToggle from "@/shared/ui/theme-toggle/ThemeToggle";
import BusinessPlaceCard from "@/widgets/place-card";
import {
  ShimmerProvider,
  CategorySkeletonRow,
  FeaturedSkeletonRow,
  RecommendedSkeletonList,
} from "@/shared/ui/shimmer";
import { LanguagePickerModal } from "@/shared/ui/app-header/LanguagePickerModal";
import { NotificationsSheetModal } from "@/shared/ui/notifications-sheet";
import { CityPickerField, useProfileCityPicker } from "@/shared/ui/city-picker";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { homePageStaticStyles, homePageThemeStyles } from "./homePageStyles";
import {
  CATEGORY_PILL_ESTIMATED_WIDTH,
  FEATURED_CARD_HEIGHT,
  FEATURED_CARD_ESTIMATED_WIDTH,
  FEATURED_CARD_IMAGE_HEIGHT,
  FEATURED_CARD_ITEM_GAP,
  FEATURED_CARD_WIDTH,
  HOME_CATEGORY_PILL_HEIGHT,
  RECOMMENDED_BATCH_SIZE,
  RECOMMENDED_ITEM_ESTIMATED_SIZE,
} from "../model/constants";
import { buildHomeCategoryList, type HomeCategoryListItem } from "../lib/buildHomeCategoryList";
import { AnimatedHomeSparklesIcon } from "@/shared/ui/animated-home-header-icons";
import { useSubscriptionGatedNavigation } from "@/features/subscription-paywall-redirect";
import { useBookingAccess } from "@/features/booking-access";
import { BookingCreditsBadge } from "@/shared/ui/booking-credits-badge/BookingCreditsBadge";
import { DailyPicksHero, DailyPicksHeroSkeleton, isDailyPicksHeroLoading, resolveDailyPicksHeroDisplay } from "@/widgets/daily-picks-hero";
import { preloadSmartImages } from "@/shared/ui/smart-image/SmartImage";
import { getBusinessCardThumbUris } from "@/shared/lib/business-card/businessCardDisplayUrl";
import { getBusinessCardCoverBlurhash } from "@/shared/lib/business-card/businessCardBlurhash";
import { useExpandVisibleBatch } from "@/shared/lib/useExpandVisibleBatch";
import { ShowMoreButton } from "@/shared/ui/show-more-button";
import { resetBookingChatPersistedSession } from "@/features/ai-booking-chat";
import { DailyMoodCheckinPrompt } from "@/features/daily-mood-checkin";
import { hasTrialBannerDismissed, setTrialBannerDismissed } from "../lib/trialBannerStorage";

import { categoryAccentColor } from "../lib/categoryAccentColors";

const RECOMMENDED_THUMB_SIZE = 96;
const PIX_AI_PLACEHOLDER_CYCLE_MS = 10000;
const PIX_AI_PLACEHOLDER_TYPE_MS = 1800;
const PIX_AI_FIELD_GRADIENT_LIGHT = ["#9333ea26", "#db277726", "#f9731626"] as const;
const PIX_AI_FIELD_GRADIENT_DARK = ["#9333ea40", "#db277740", "#f9731640"] as const;

function thumbUriForCard(place: BusinessCard, layoutW: number, layoutH: number): string | null {
  const dpr = Math.min(2, PixelRatio.get());
  return getBusinessCardThumbUris(place, {
    layoutPx: layoutW * dpr,
    layoutPxHeight: layoutH * dpr,
  }).uri;
}

/** Types `fullText` out, holds it, then restarts — looping every ~10s. */
function usePixAiPlaceholderTypewriter(fullText: string): string {
  const [visible, setVisible] = useState("");

  useEffect(() => {
    if (!fullText) {
      setVisible("");
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tickMs = Math.max(18, PIX_AI_PLACEHOLDER_TYPE_MS / fullText.length);
    const holdMs = Math.max(500, PIX_AI_PLACEHOLDER_CYCLE_MS - PIX_AI_PLACEHOLDER_TYPE_MS);

    const runCycle = () => {
      let i = 0;
      setVisible("");
      const typeStep = () => {
        if (cancelled) return;
        i += 1;
        setVisible(fullText.slice(0, i));
        timer = setTimeout(i < fullText.length ? typeStep : runCycle, i < fullText.length ? tickMs : holdMs);
      };
      timer = setTimeout(typeStep, tickMs);
    };
    runCycle();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fullText]);

  return visible;
}

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "HomeMain">,
  BottomTabNavigationProp<RootTabParamList>
>;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();
  const { user, loading: authLoading } = useAuth();
  const { isLoading: profileLoading } = useProfile();
  const homeAuthUserRef = useRef<string | null>(null);
  const { selectedCity, selectCity, isCityReady } = useProfileCityPicker();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [visibleRecommendedCount, setVisibleRecommendedCount] = useState(RECOMMENDED_BATCH_SIZE);
  const { isLoadingMore: isLoadingMoreRecommended, expand: expandRecommendedBatch } = useExpandVisibleBatch();
  const { data: featured = [], isLoading: lf } = useBusinessCards("featured", selectedCity, {
    enabled: isCityReady,
  });
  const { data: recommended = [], isLoading: lr } = useBusinessCards("recommended", selectedCity, {
    enabled: isCityReady,
  });
  const { data: categories = [], isLoading: lc } = useCategories();
  const homeCategories = useMemo(() => buildHomeCategoryList(categories), [categories]);
  const { data: dailyRecommendations = [], isFetched: dailyRecsFetched } = useDailyRecommendations();
  const trackRecommendationEvent = useTrackRecommendationEvent();
  const trackRecommendationInteraction = useTrackRecommendationInteraction();
  const unread = useUnreadCount();
  const { openAIBooking } = useSubscriptionGatedNavigation(navigation);
  const { isIntroActive, hasPaidPremium, balance, introPeriodEndsAt } = useBookingAccess();
  const pixAiPlaceholder = usePixAiPlaceholderTypewriter(t("aiBooking.assistantGreeting"));
  const [trialBannerDismissed, setTrialBannerDismissedState] = useState(false);
  const showTrialBanner = !!user && isIntroActive && !hasPaidPremium && !trialBannerDismissed;

  useEffect(() => {
    if (!user?.id) return;
    void hasTrialBannerDismissed(user.id).then(setTrialBannerDismissedState);
  }, [user?.id]);

  const handleDismissTrialBanner = useCallback(() => {
    setTrialBannerDismissedState(true);
    if (user?.id) void setTrialBannerDismissed(user.id);
  }, [user?.id]);

  /** Horizontal padding 16 + 16 from `content` — matches full-width recommended cards */
  const recommendedCardWidth = windowWidth - 32;
  const featuredLoading = !isCityReady || lf;
  const recommendedLoading = !isCityReady || lr;
  const dailyRecsEnabled = Boolean(user?.id) && !authLoading && !profileLoading;

  useFocusEffect(
    useCallback(() => {
      const authUserId = user?.id ?? null;
      const sessionChanged = homeAuthUserRef.current !== authUserId;
      homeAuthUserRef.current = authUserId;
      if (!sessionChanged) return;

      void queryClient.refetchQueries({ queryKey: queryKeys.categories.all });
      void queryClient.refetchQueries({ queryKey: queryKeys.businessCards.listPrefix });
      void queryClient.refetchQueries({ queryKey: queryKeys.dailyRecommendations.prefix });
      void queryClient.refetchQueries({ queryKey: queryKeys.profile.root });
    }, [queryClient, user?.id]),
  );

  useEffect(() => {
    setVisibleRecommendedCount(RECOMMENDED_BATCH_SIZE);
  }, [recommended, selectedCity]);

  const themed = useThemeStyles(
    ({ colors: c }) => homePageThemeStyles(c),
    [],
  );
  const styles = useMemo(
    () => mergeStaticAndThemed(homePageStaticStyles, themed),
    [themed],
  );

  const visibleRecommended = useMemo(
    () => recommended.slice(0, visibleRecommendedCount),
    [recommended, visibleRecommendedCount],
  );

  const dailyPicksHeroDisplay = useMemo(
    () => resolveDailyPicksHeroDisplay(dailyRecommendations, featured.length ? featured : recommended),
    [dailyRecommendations, featured, recommended],
  );
  const isDailyPicksHeroPending = isDailyPicksHeroLoading({
    isAuthenticated: Boolean(user),
    dailyRecsEnabled,
    dailyRecsFetched,
    featuredLoading,
    recommendedLoading,
    hasFeatured: featured.length > 0,
    hasRecommended: recommended.length > 0,
  });
  const homeQueriesLoading = lc || featuredLoading || recommendedLoading || isDailyPicksHeroPending;

  useEffect(() => {
    if (!featured.length) return;
    const uris = featured
      .slice(0, 8)
      .map((p) => thumbUriForCard(p, FEATURED_CARD_WIDTH, FEATURED_CARD_IMAGE_HEIGHT));
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    const timer = setTimeout(() => {
      task = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) void preloadSmartImages(uris);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [featured]);

  useEffect(() => {
    if (!visibleRecommended.length) return;
    const uris = visibleRecommended
      .slice(0, 8)
      .map((p) => thumbUriForCard(p, RECOMMENDED_THUMB_SIZE, RECOMMENDED_THUMB_SIZE));
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    const timer = setTimeout(() => {
      task = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) void preloadSmartImages(uris);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [visibleRecommended]);

  const recommendedListExtraData = useMemo(
    () =>
      visibleRecommended
        .map(
          (p) =>
            `${p.id}:${p.images[0] ?? p.image ?? ""}:${getBusinessCardCoverBlurhash(p.blurhashes) ?? ""}`,
        )
        .join("|"),
    [visibleRecommended],
  );
  const canShowMoreRecommended = visibleRecommendedCount < recommended.length;

  const handleCityPickerOpen = useCallback(() => {
    if (user) return true;
    navigateToProfileAuth(navigation);
    return false;
  }, [navigation, user]);

  const handleCityChange = useCallback(
    async (city: string) => {
      const changed = await selectCity(city);
      if (changed) {
        await resetBookingChatPersistedSession();
      }
    },
    [selectCity],
  );

  const handleOpenAIBooking = useCallback(() => {
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    openAIBooking();
  }, [navigation, openAIBooking, user]);

  const renderCategoryRow = useCallback<ListRenderItem<HomeCategoryListItem>>(
    ({ item }) => {
      const iconSpec = resolveCategoryIconSpec(item.name);
      const label = localizeCategoryName(item.name, t);
      return (
        <AppPressable
          style={[styles.pill, item.isComingSoon && styles.pillComingSoon]}
          disabled={item.isComingSoon}
          accessibilityRole="button"
          accessibilityState={{ disabled: item.isComingSoon }}
          accessibilityLabel={
            item.isComingSoon
              ? `${label}, ${t("home.categoryComingSoon")}`
              : label
          }
          onPress={() => {
            if (item.isComingSoon) return;
            navigation.navigate("Category", { id: item.id });
          }}
        >
          <View style={styles.pillContent}>
            <View
              style={[
                styles.pillIconWrap,
                { backgroundColor: `${categoryAccentColor(item.name)}22` },
              ]}
            >
              <CategoryIcon spec={iconSpec} size={16} color={categoryAccentColor(item.name)} />
            </View>
            <Text style={styles.pillText}>{label}</Text>
            {item.isComingSoon ? (
              <View style={styles.categoryComingSoonBadge}>
                <Text style={styles.categoryComingSoonBadgeText}>{t("home.categoryComingSoon")}</Text>
              </View>
            ) : null}
          </View>
        </AppPressable>
      );
    },
    [colors.primary, navigation, styles, t],
  );

  const renderFeaturedRow = useCallback<ListRenderItem<BusinessCard>>(
    ({ item }) => (
      <View style={styles.featuredCardWrap}>
        <BusinessPlaceCard
          place={item}
          variant="vertical"
          enhancedTagContrast
          verticalWidth={FEATURED_CARD_WIDTH}
          verticalImageHeight={FEATURED_CARD_IMAGE_HEIGHT}
        />
      </View>
    ),
    [styles.featuredCardWrap],
  );

  const renderRecommendedRow = useCallback<ListRenderItem<BusinessCard>>(
    ({ item }) => (
      <View style={styles.recommendedItemWrap}>
        <BusinessPlaceCard place={item} variant="horizontal" enhancedTagContrast />
      </View>
    ),
    [styles.recommendedItemWrap],
  );

  const openDailyPicksHero = useCallback(() => {
    const { source, recommendation } = dailyPicksHeroDisplay;

    if (source === "recommendation" && recommendation) {
      trackRecommendationEvent.mutate({
        event_name: "daily_recommendations_opened",
        payload: { source: "home_hero", top_venue_id: recommendation.venue_id },
      });
      trackRecommendationInteraction.mutate({
        venueId: recommendation.venue_id,
        interactionType: "open",
        source: "home_hero",
        metadata: { generated_rank: recommendation.generated_rank },
      });
      navigation.navigate("DailyRecommendations");
      return;
    }

    if (source === "recent" && recommendation) {
      navigation.navigate("PlaceDetail", { id: recommendation.venue_id });
      return;
    }

    navigation.navigate("SearchMain");
  }, [dailyPicksHeroDisplay, navigation, trackRecommendationEvent, trackRecommendationInteraction]);

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <CityPickerField
              value={selectedCity}
              onChange={handleCityChange}
              onOpen={handleCityPickerOpen}
              triggerStyle={styles.cityHeaderSelector}
              textStyle={styles.cityHeaderSelectorText}
              showLocationIcon
              hideCountry
            />
          </View>
          <Text style={styles.logo}>Pixap</Text>
          <View style={styles.headerRight}>
          <AppPressable
              style={[styles.vibeMatchBtn, styles.bellWrap]}
              accessibilityRole="button"
              accessibilityLabel={t("home.a11y.openNotifications")}
              onPress={() => setNotificationsOpen(true)}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              {unread > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unread > 9 ? "9+" : String(unread)}</Text>
                </View>
              ) : null}
            </AppPressable>
            <AppPressable
              style={styles.vibeMatchBtn}
              accessibilityRole="button"
              accessibilityLabel={t("language.choose")}
              onPress={() => setLanguageOpen(true)}
            >
              <Ionicons name="language-outline" size={20} color={colors.text} />
            </AppPressable>
            <ThemeToggle size={20} style={styles.vibeMatchBtn} />
          </View>
        </View>
        <LanguagePickerModal visible={languageOpen} onClose={() => setLanguageOpen(false)} />
        <NotificationsSheetModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />

        <AppPressable
          style={styles.searchBtn}
          accessibilityRole="button"
          accessibilityLabel={t("home.a11y.openPixaiBooking")}
          onPress={handleOpenAIBooking}
        >
          <LinearGradient
            colors={isDark ? [...PIX_AI_FIELD_GRADIENT_DARK] : [...PIX_AI_FIELD_GRADIENT_LIGHT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.searchBtnGradientFill}
          >
            <AnimatedHomeSparklesIcon size={18} color={colors.primary} />
            <Text style={styles.searchBtnText} numberOfLines={1} ellipsizeMode="tail">
              {pixAiPlaceholder}
            </Text>
          </LinearGradient>
        </AppPressable>

        {showTrialBanner ? (
          <AppPressable
            style={[
              homePageStaticStyles.trialBanner,
              {
                backgroundColor: isDark ? `${colors.accent}55` : `${colors.accent}38`,
                borderColor: isDark ? `${colors.accent}90` : `${colors.accent}72`,
              },
            ]}
            onPress={handleOpenAIBooking}
            accessibilityRole="button"
          >
            <BookingCreditsBadge
              balance={balance}
              isIntroActive={isIntroActive}
              hasPaidPremium={hasPaidPremium}
              introPeriodEndsAt={introPeriodEndsAt}
              compact
              style={[homePageStaticStyles.trialBannerBadge, { backgroundColor: "transparent", borderColor: "transparent", paddingHorizontal: 0, paddingVertical: 0 }]}
            />
            <AppPressable
              hitSlop={8}
              onPress={handleDismissTrialBanner}
              accessibilityRole="button"
              accessibilityLabel={t("bookingCredits.trialBannerDismiss")}
            >
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </AppPressable>
          </AppPressable>
        ) : null}

        {isDailyPicksHeroPending ? (
          <DailyPicksHeroSkeleton />
        ) : (
          <DailyPicksHero display={dailyPicksHeroDisplay} onOpen={openDailyPicksHero} />
        )}

        <Text style={styles.sectionTitle}>{t("home.categories")}</Text>
        {lc ? (
          <View style={styles.categoriesFlatList}>
            <CategorySkeletonRow pillHeight={HOME_CATEGORY_PILL_HEIGHT} />
          </View>
        ) : (
          <FlashList
            horizontal
            style={styles.categoriesFlatList}
            data={homeCategories}
            keyExtractor={(c) => c.id}
            estimatedItemSize={CATEGORY_PILL_ESTIMATED_WIDTH}
            showsHorizontalScrollIndicator={false}
            renderItem={renderCategoryRow}
          />
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{t("home.featured")}</Text>
          <AppPressable onPress={() => navigation.navigate("SearchMain")}>
            <Text style={styles.link}>{t("home.seeAll")}</Text>
          </AppPressable>
        </View>
        {featuredLoading ? (
          <FeaturedSkeletonRow
            cardWidth={FEATURED_CARD_WIDTH}
            cardHeight={FEATURED_CARD_HEIGHT}
            imageHeight={FEATURED_CARD_IMAGE_HEIGHT}
            itemGap={FEATURED_CARD_ITEM_GAP}
          />
        ) : featured.length === 0 ? (
          <View style={styles.featuredEmpty}>
            <View style={styles.featuredEmptyIconWrap}>
              <Ionicons name="storefront-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.featuredEmptyTitle}>{t("home.featuredEmpty.title")}</Text>
            <Text style={styles.featuredEmptySubtitle}>{t("home.featuredEmpty.subtitle")}</Text>
          </View>
        ) : (
          <FlashList
            horizontal
            style={styles.featuredList}
            data={featured}
            keyExtractor={(p) => p.id}
            estimatedItemSize={FEATURED_CARD_ESTIMATED_WIDTH}
            showsHorizontalScrollIndicator={false}
            renderItem={renderFeaturedRow}
          />
        )}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{t("home.recommended")}</Text>
        {recommendedLoading ? <RecommendedSkeletonList cardWidth={recommendedCardWidth} /> : null}
      </>
    ),
    [
      categories,
      homeCategories,
      colors,
      dailyPicksHeroDisplay,
      isDailyPicksHeroPending,
      featured,
      handleOpenAIBooking,
      handleCityChange,
      handleCityPickerOpen,
      isDark,
      i18n.language,
      languageOpen,
      lc,
      featuredLoading,
      recommendedLoading,
      navigation,
      notificationsOpen,
      openDailyPicksHero,
      pixAiPlaceholder,
      recommendedCardWidth,
      renderCategoryRow,
      renderFeaturedRow,
      selectedCity,
      showTrialBanner,
      balance,
      isIntroActive,
      hasPaidPremium,
      introPeriodEndsAt,
      handleDismissTrialBanner,
      styles,
      t,
      unread,
    ],
  );

  const handleShowMoreRecommended = useCallback(() => {
    expandRecommendedBatch(() => {
      setVisibleRecommendedCount((prev) => prev + RECOMMENDED_BATCH_SIZE);
    });
  }, [expandRecommendedBatch]);

  const listFooter = useMemo(
    () =>
      !recommendedLoading && (canShowMoreRecommended || isLoadingMoreRecommended) ? (
        <ShowMoreButton
          label={t("home.showMore")}
          loading={isLoadingMoreRecommended}
          onPress={handleShowMoreRecommended}
          style={styles.showMoreBtn}
          textStyle={styles.showMoreBtnText}
          spinnerColor={colors.onAccent}
        />
      ) : null,
    [
      canShowMoreRecommended,
      colors.onAccent,
      handleShowMoreRecommended,
      i18n.language,
      isLoadingMoreRecommended,
      recommendedLoading,
      styles.showMoreBtn,
      styles.showMoreBtnText,
      t,
    ],
  );

  const listContentStyle = useMemo(
    () => [styles.content, { paddingTop: Math.max(insets.top, 12) }],
    [insets.top, styles.content],
  );

  return (
    <ShimmerProvider active={homeQueriesLoading}>
      <FlashList
        style={styles.root}
        data={recommendedLoading ? [] : visibleRecommended}
        extraData={`${i18n.language}|${recommendedListExtraData}|${isDark ? "d" : "l"}`}
        keyExtractor={(p) => p.id}
        estimatedItemSize={RECOMMENDED_ITEM_ESTIMATED_SIZE}
        renderItem={renderRecommendedRow}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        contentContainerStyle={listContentStyle}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={8}
        updateCellsBatchingPeriod={40}
      />
      <DailyMoodCheckinPrompt enabled={dailyRecsEnabled} />
    </ShimmerProvider>
  );
}
