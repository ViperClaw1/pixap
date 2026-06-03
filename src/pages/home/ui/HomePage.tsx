import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  PixelRatio,
  InteractionManager
} from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
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
  FEATURED_CARD_ESTIMATED_WIDTH,
  HOME_CATEGORY_PILL_HEIGHT,
  RECOMMENDED_BATCH_SIZE,
  RECOMMENDED_ITEM_ESTIMATED_SIZE,
} from "../model/constants";
import { buildHomeCategoryList, type HomeCategoryListItem } from "../lib/buildHomeCategoryList";
import { AnimatedHomeSparklesIcon, AnimatedHomeVibeIcon } from "@/shared/ui/animated-home-header-icons";
import { useSubscriptionGatedNavigation } from "@/features/subscription-paywall-redirect";
import { DailyPicksHero } from "@/widgets/daily-picks-hero";
import { preloadSmartImages } from "@/shared/ui/smart-image/SmartImage";
import { getBusinessCardThumbUris } from "@/shared/lib/business-card/businessCardDisplayUrl";
import { getBusinessCardCoverBlurhash } from "@/shared/lib/business-card/businessCardBlurhash";
import { useExpandVisibleBatch } from "@/shared/lib/useExpandVisibleBatch";
import { ShowMoreButton } from "@/shared/ui/show-more-button";
import { resetBookingChatPersistedSession } from "@/features/ai-booking-chat";

const VIBE_TOOLBAR_GRADIENT_LIGHT = ["#9333ea", "#db2777", "#f97316"] as const;
const FEATURED_THUMB_W = 200;
const FEATURED_THUMB_H = 140;
const RECOMMENDED_THUMB_SIZE = 96;

function thumbUriForCard(place: BusinessCard, layoutW: number, layoutH: number): string | null {
  const dpr = Math.min(2, PixelRatio.get());
  return getBusinessCardThumbUris(place, {
    layoutPx: layoutW * dpr,
    layoutPxHeight: layoutH * dpr,
  }).uri;
}
const VIBE_TOOLBAR_GRADIENT_DARK = ["#6d28d9", "#be185d", "#ea580c"] as const;

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "HomeMain">,
  BottomTabNavigationProp<RootTabParamList>
>;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useStaticWindowSize();
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const { selectedCity, selectCity } = useProfileCityPicker();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [visibleRecommendedCount, setVisibleRecommendedCount] = useState(RECOMMENDED_BATCH_SIZE);
  const { isLoadingMore: isLoadingMoreRecommended, expand: expandRecommendedBatch } = useExpandVisibleBatch();
  const { data: featured = [], isLoading: lf } = useBusinessCards("featured", selectedCity);
  const { data: recommended = [], isLoading: lr } = useBusinessCards("recommended", selectedCity);
  const { data: categories = [], isLoading: lc } = useCategories();
  const homeCategories = useMemo(() => buildHomeCategoryList(categories), [categories]);
  const { data: dailyRecommendations = [] } = useDailyRecommendations();
  const trackRecommendationEvent = useTrackRecommendationEvent();
  const trackRecommendationInteraction = useTrackRecommendationInteraction();
  const unread = useUnreadCount();
  const { openAIBooking, openVibeMatch } = useSubscriptionGatedNavigation(navigation);

  /** Horizontal padding 16 + 16 from `content` — matches full-width recommended cards */
  const recommendedCardWidth = windowWidth - 32;
  const homeQueriesLoading = lc || lf || lr;

  useEffect(() => {
    setVisibleRecommendedCount(RECOMMENDED_BATCH_SIZE);
  }, [recommended, selectedCity]);

  const themed = useThemeStyles(
    ({ colors: c, isDark: dark }) => homePageThemeStyles(c, dark),
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

  useEffect(() => {
    if (!featured.length) return;
    const uris = featured
      .slice(0, 8)
      .map((p) => thumbUriForCard(p, FEATURED_THUMB_W, FEATURED_THUMB_H));
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

  const handleOpenVibeMatch = useCallback(() => {
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    openVibeMatch();
  }, [navigation, openVibeMatch, user]);

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
            <View style={styles.pillIconWrap}>
              <CategoryIcon spec={iconSpec} size={14} color={colors.primary} />
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
        <BusinessPlaceCard place={item} variant="vertical" enhancedTagContrast />
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

  const openDailyRecommendations = useCallback(() => {
    const top = dailyRecommendations[0];
    trackRecommendationEvent.mutate({
      event_name: "daily_recommendations_opened",
      payload: { source: "home_hero", top_venue_id: top?.venue_id ?? null },
    });
    if (top) {
      trackRecommendationInteraction.mutate({
        venueId: top.venue_id,
        interactionType: "open",
        source: "home_hero",
        metadata: { generated_rank: top.generated_rank },
      });
    }
    navigation.navigate("DailyRecommendations");
  }, [dailyRecommendations, navigation, trackRecommendationEvent, trackRecommendationInteraction]);

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AppPressable
              style={styles.aiBookingBtn}
              accessibilityRole="button"
              accessibilityLabel={t("home.a11y.openPixaiBooking")}
              onPress={handleOpenAIBooking}
            >
              <AnimatedHomeSparklesIcon size={16} color={colors.onPrimary} />
              <Text
                style={styles.headerActionLabel}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {t("home.pixAiBooking")}
              </Text>
            </AppPressable>
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
        <View style={styles.cityToolbarRow}>
          <CityPickerField
            value={selectedCity}
            onChange={handleCityChange}
            onOpen={handleCityPickerOpen}
            triggerStyle={styles.citySelector}
          />
          <AppPressable
            accessibilityRole="button"
            accessibilityLabel={t("home.a11y.openPixaiVibeMatch")}
            onPress={handleOpenVibeMatch}
            style={styles.vibeToolbarPressable}
          >
            <LinearGradient
              colors={isDark ? [...VIBE_TOOLBAR_GRADIENT_DARK] : [...VIBE_TOOLBAR_GRADIENT_LIGHT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.vibeToolbarGradient}
            >
              <AnimatedHomeVibeIcon size={16} color="#ffffff" />
              <Text style={styles.vibeToolbarLabel} numberOfLines={1} ellipsizeMode="tail">
                {t("home.vibeMatching", { defaultValue: "Vibe Matching" })}
              </Text>
            </LinearGradient>
          </AppPressable>
        </View>

        <AppPressable
          style={[
            homePageStaticStyles.searchBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => navigation.navigate("SearchMain")}
        >
          <Text style={[homePageStaticStyles.searchBtnText, { color: colors.textMuted }]}>
            {t("home.searchPlaceholder")}
          </Text>
        </AppPressable>

        <DailyPicksHero recommendation={dailyRecommendations[0] ?? null} onOpen={openDailyRecommendations} />

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
        {lf ? (
          <FeaturedSkeletonRow />
        ) : (
          <FlashList
            horizontal
            data={featured}
            keyExtractor={(p) => p.id}
            estimatedItemSize={FEATURED_CARD_ESTIMATED_WIDTH}
            showsHorizontalScrollIndicator={false}
            renderItem={renderFeaturedRow}
          />
        )}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{t("home.recommended")}</Text>
        {lr ? <RecommendedSkeletonList cardWidth={recommendedCardWidth} /> : null}
      </>
    ),
    [
      categories,
      homeCategories,
      colors,
      dailyRecommendations,
      featured,
      handleOpenAIBooking,
      handleOpenVibeMatch,
      handleCityChange,
      handleCityPickerOpen,
      isDark,
      i18n.language,
      languageOpen,
      lc,
      lf,
      lr,
      navigation,
      notificationsOpen,
      openDailyRecommendations,
      recommendedCardWidth,
      renderCategoryRow,
      renderFeaturedRow,
      selectedCity,
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
      !lr && (canShowMoreRecommended || isLoadingMoreRecommended) ? (
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
      lr,
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
        data={lr ? [] : visibleRecommended}
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
    </ShimmerProvider>
  );
}
