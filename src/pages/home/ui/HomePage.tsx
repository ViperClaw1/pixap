import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  Alert,
  TextInput,
  PixelRatio,
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
  useAvailableCities,
  ALL_CITIES_OPTION,
  groupCitiesByCountry,
  filterCityGroups,
  matchesSearchTokens,
  type BusinessCard,
} from "@/entities/business-card";
import { useCategories, CategoryIcon, resolveCategoryIconSpec, localizeCategoryName } from "@/entities/category";
import { useUnreadCount } from "@/entities/notification";
import {
  useDailyRecommendations,
  useTrackRecommendationEvent,
  useTrackRecommendationInteraction,
} from "@/entities/daily-recommendation";
import { useProfile, useUpdateProfile } from "@/entities/user";
import type { HomeStackParamList, RootTabParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import ThemeToggle from "@/shared/ui/theme-toggle/ThemeToggle";
import BusinessPlaceCard from "@/widgets/place-card";
import {
  ShimmerProvider,
  CategorySkeletonRow,
  FeaturedSkeletonRow,
  RecommendedSkeletonList,
} from "@/shared/ui/shimmer";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { LanguagePickerModal } from "@/shared/ui/app-header/LanguagePickerModal";
import { NotificationsSheetModal } from "@/shared/ui/notifications-sheet";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { homePageStaticStyles, homePageThemeStyles } from "./homePageStyles";
import {
  CATEGORY_PILL_ESTIMATED_WIDTH,
  FEATURED_CARD_ESTIMATED_WIDTH,
  RECOMMENDED_BATCH_SIZE,
  RECOMMENDED_ITEM_ESTIMATED_SIZE,
} from "../model/constants";
import { buildHomeCategoryList, type HomeCategoryListItem } from "../lib/buildHomeCategoryList";
import { AnimatedHomeSparklesIcon, AnimatedHomeVibeIcon } from "@/shared/ui/animated-home-header-icons";
import { useSubscriptionGatedNavigation } from "@/features/subscription-paywall-redirect";
import { DailyPicksHero } from "@/widgets/daily-picks-hero";
import { preloadSmartImages } from "@/shared/ui/smart-image/SmartImage";
import { getBusinessCardThumbUris } from "@/shared/lib/business-card/businessCardDisplayUrl";

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
  const { width: windowWidth } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [selectedCity, setSelectedCity] = useState(ALL_CITIES_OPTION);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [visibleRecommendedCount, setVisibleRecommendedCount] = useState(RECOMMENDED_BATCH_SIZE);
  const { data: availableCities = [ALL_CITIES_OPTION] } = useAvailableCities();

  const concreteCities = useMemo(
    () => availableCities.filter((c) => c !== ALL_CITIES_OPTION),
    [availableCities],
  );

  const filteredCityGroups = useMemo(() => {
    const grouped = groupCitiesByCountry(concreteCities);
    return filterCityGroups(grouped, citySearchQuery);
  }, [concreteCities, citySearchQuery]);

  const showAllCitiesOption = useMemo(() => {
    if (!availableCities.includes(ALL_CITIES_OPTION)) return false;
    return matchesSearchTokens(ALL_CITIES_OPTION, citySearchQuery);
  }, [availableCities, citySearchQuery]);
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
    const cityFromProfile = profile?.city?.trim();
    setSelectedCity(cityFromProfile ? cityFromProfile : ALL_CITIES_OPTION);
  }, [profile?.city]);

  useEffect(() => {
    setVisibleRecommendedCount(RECOMMENDED_BATCH_SIZE);
  }, [recommended, selectedCity]);

  const handleSelectCity = async (city: string) => {
    setCityModalVisible(false);
    if (city === selectedCity) return;
    const previous = selectedCity;
    setSelectedCity(city);
    try {
      await updateProfile.mutateAsync({ city: city === ALL_CITIES_OPTION ? null : city });
    } catch {
      setSelectedCity(previous);
      Alert.alert(t("home.alerts.citySaveTitle"), t("home.alerts.citySaveBody"));
    }
  };

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
    void preloadSmartImages(uris);
  }, [featured]);

  useEffect(() => {
    if (!visibleRecommended.length) return;
    const uris = visibleRecommended
      .slice(0, 8)
      .map((p) => thumbUriForCard(p, RECOMMENDED_THUMB_SIZE, RECOMMENDED_THUMB_SIZE));
    void preloadSmartImages(uris);
  }, [visibleRecommended]);

  const recommendedListExtraData = useMemo(
    () =>
      visibleRecommended
        .map((p) => `${p.id}:${p.images[0] ?? p.image ?? ""}`)
        .join("|"),
    [visibleRecommended],
  );
  const canShowMoreRecommended = visibleRecommendedCount < recommended.length;

  const renderCategoryRow = useCallback<ListRenderItem<HomeCategoryListItem>>(
    ({ item }) => {
      const iconSpec = resolveCategoryIconSpec(item.name);
      const label = localizeCategoryName(item.name, t);
      return (
        <Pressable
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
        </Pressable>
      );
    },
    [colors.primary, navigation, styles, t],
  );

  const renderFeaturedRow = useCallback<ListRenderItem<BusinessCard>>(
    ({ item }) => (
      <View style={styles.featuredCardWrap}>
        <BusinessPlaceCard place={item} variant="vertical" />
      </View>
    ),
    [styles.featuredCardWrap],
  );

  const renderRecommendedRow = useCallback<ListRenderItem<BusinessCard>>(
    ({ item }) => (
      <View style={styles.recommendedGap}>
        <BusinessPlaceCard key={item.id} place={item} variant="horizontal" />
      </View>
    ),
    [styles.recommendedGap],
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
            <Pressable
              style={styles.aiBookingBtn}
              accessibilityRole="button"
              accessibilityLabel={t("home.a11y.openPixaiBooking")}
              onPress={() => openAIBooking()}
            >
              <AnimatedHomeSparklesIcon size={16} color={colors.onPrimary} />
              <Text
                style={styles.headerActionLabel}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {t("home.pixAiBooking", { defaultValue: "Pix AI booking" })}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.logo}>Pixap</Text>
          <View style={styles.headerRight}>
          <Pressable
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
            </Pressable>
            <Pressable
              style={styles.vibeMatchBtn}
              accessibilityRole="button"
              accessibilityLabel={t("language.choose")}
              onPress={() => setLanguageOpen(true)}
            >
              <Ionicons name="language-outline" size={20} color={colors.text} />
            </Pressable>
            <ThemeToggle size={20} style={styles.vibeMatchBtn} />
          </View>
        </View>
        <LanguagePickerModal visible={languageOpen} onClose={() => setLanguageOpen(false)} />
        <NotificationsSheetModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        <View style={styles.cityToolbarRow}>
          <Pressable
            style={styles.citySelector}
            onPress={() => {
              setCitySearchQuery("");
              setCityModalVisible(true);
            }}
          >
            <Text style={styles.citySelectorText} numberOfLines={1}>
              {selectedCity === ALL_CITIES_OPTION ? t("home.allCities") : selectedCity}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("home.a11y.openPixaiVibeMatch")}
            onPress={() => openVibeMatch()}
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
          </Pressable>
        </View>

        <Pressable style={styles.searchBtn} onPress={() => navigation.navigate("SearchMain")}>
          <Text style={styles.searchBtnText}>{t("home.searchPlaceholder")}</Text>
        </Pressable>

        <DailyPicksHero recommendation={dailyRecommendations[0] ?? null} onOpen={openDailyRecommendations} />

        <Text style={styles.sectionTitle}>{t("home.categories")}</Text>
        {lc ? (
          <CategorySkeletonRow />
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
          <Pressable onPress={() => navigation.navigate("SearchMain")}>
            <Text style={styles.link}>{t("home.seeAll")}</Text>
          </Pressable>
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

  const listFooter = useMemo(
    () =>
      !lr && canShowMoreRecommended ? (
        <Pressable
          style={styles.showMoreBtn}
          onPress={() => setVisibleRecommendedCount((prev) => prev + RECOMMENDED_BATCH_SIZE)}
        >
          <Text style={styles.showMoreBtnText}>{t("home.showMore")}</Text>
        </Pressable>
      ) : null,
    [canShowMoreRecommended, i18n.language, lr, styles.showMoreBtn, styles.showMoreBtnText, t],
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
        extraData={`${i18n.language}|${recommendedListExtraData}`}
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

      <BottomSheetPickerModal
        visible={cityModalVisible}
        onClose={() => {
          setCitySearchQuery("");
          setCityModalVisible(false);
        }}
        title={t("home.chooseCity")}
        maxHeightFraction={0.72}
      >
        <View style={styles.citySearchBox}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={citySearchQuery}
            onChangeText={setCitySearchQuery}
            placeholder={t("home.citySearchPlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={styles.citySearchInput}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        {showAllCitiesOption ? (
          <Pressable
            key={ALL_CITIES_OPTION}
            style={styles.cityRow}
            onPress={() => void handleSelectCity(ALL_CITIES_OPTION)}
          >
            <Text style={styles.cityRowText}>{t("home.allCities")}</Text>
            {selectedCity === ALL_CITIES_OPTION ? <Text style={styles.cityCheck}>{t("home.selected")}</Text> : null}
          </Pressable>
        ) : null}

        {filteredCityGroups.map(({ country, cities }) => (
          <View key={country}>
            <View style={styles.countryHeader}>
              <Text style={styles.countryHeaderText}>{country}</Text>
            </View>
            {cities.map((city) => (
              <Pressable key={city} style={styles.cityRow} onPress={() => void handleSelectCity(city)}>
                <Text style={styles.cityRowText}>{city}</Text>
                {city === selectedCity ? <Text style={styles.cityCheck}>{t("home.selected")}</Text> : null}
              </Pressable>
            ))}
          </View>
        ))}

        {!showAllCitiesOption && filteredCityGroups.length === 0 ? (
          <View style={styles.cityPickerEmpty}>
            <Text style={styles.cityPickerEmptyText}>{t("home.noCitiesMatch")}</Text>
          </View>
        ) : null}
      </BottomSheetPickerModal>
    </ShimmerProvider>
  );
}
