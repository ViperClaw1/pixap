import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ScrollView,
  useWindowDimensions,
  Alert,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
} from "@/entities/business-card";
import { useCategories, CategoryIcon, resolveCategoryIconSpec } from "@/entities/category";
import { useUnreadCount } from "@/entities/notification";
import { useProfile, useUpdateProfile } from "@/entities/user";
import type { HomeStackParamList, RootTabParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import ThemeToggle from "@/shared/ui/theme-toggle/ThemeToggle";
import BusinessPlaceCard from "@/components/BusinessPlaceCard";
import {
  ShimmerProvider,
  CategorySkeletonRow,
  FeaturedSkeletonRow,
  RecommendedSkeletonList,
} from "@/shared/ui/shimmer";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { LanguagePickerModal } from "@/shared/ui/app-header/LanguagePickerModal";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "HomeMain">,
  BottomTabNavigationProp<RootTabParamList>
>;

export default function HomeScreen() {
  const RECOMMENDED_BATCH_SIZE = 20;
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [selectedCity, setSelectedCity] = useState(ALL_CITIES_OPTION);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
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
  const { data: recommended = [], isLoading: lr } = useBusinessCards(undefined, selectedCity);
  const { data: categories = [], isLoading: lc } = useCategories();
  const unread = useUnreadCount();

  const goPlace = (id: string) => navigation.navigate("PlaceDetail", { id });

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

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        content: { padding: 14, paddingBottom: 24 },
        header: {
          minHeight: 46,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        },
        headerLeft: { flexDirection: "row", alignItems: "center", zIndex: 1 },
        headerRight: { flexDirection: "row", alignItems: "center", gap: 6, zIndex: 1 },
        logo: {
          position: "absolute",
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 24,
          fontWeight: "800",
          color: colors.text,
          letterSpacing: -0.4,
          pointerEvents: "none",
        },
        sub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        citySelector: {
          marginTop: 6,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 9,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignSelf: "flex-start",
        },
        citySelectorText: { fontSize: 12, color: colors.text, fontWeight: "600" },
        badge: {
          minWidth: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 6,
        },
        badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: "700" },
        aiBookingBtn: {
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 18,
          backgroundColor: colors.notification,
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.35)",
          shadowColor: colors.notification,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.45 : 0.35,
          shadowRadius: 6,
          elevation: 5,
        },
        vibeMatchBtn: {
          width: 40,
          height: 40,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
        },
        searchBtn: {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 14,
          height: 46,
          borderRadius: 14,
          marginTop: 8,
          marginBottom: 18,
          justifyContent: "center",
        },
        searchBtnText: { color: colors.textMuted, fontSize: 14 },
        sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 10, color: colors.text, letterSpacing: -0.2 },
        sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
        link: { fontSize: 12, color: colors.link, fontWeight: "600" },
        pill: {
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: colors.card,
          borderRadius: 999,
          marginRight: 8,
          borderWidth: 1,
          borderColor: colors.border,
        },
        pillContent: { flexDirection: "row", alignItems: "center", gap: 8 },
        pillIconWrap: {
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
        },
        pillText: { color: colors.text },
        categoriesFlatList: { marginBottom: 12 },
        featuredCardWrap: { marginRight: 12 },
        recommendedGap: { marginBottom: 12 },
        showMoreBtn: {
          marginTop: 4,
          marginBottom: 8,
          alignSelf: "center",
          paddingHorizontal: 18,
          height: 44,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ec6544",
        },
        showMoreBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
        cityRow: {
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        cityRowText: { color: colors.text, fontSize: 14 },
        cityCheck: { color: colors.primary, fontWeight: "700", fontSize: 12 },
        citySearchBox: {
          marginHorizontal: 14,
          marginBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          height: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
        citySearchInput: {
          flex: 1,
          fontSize: 15,
          color: colors.text,
          paddingVertical: 0,
        },
        countryHeader: {
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 6,
          backgroundColor: colors.background,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        countryHeaderText: {
          fontSize: 12,
          fontWeight: "800",
          color: colors.textMuted,
          letterSpacing: 0.3,
          textTransform: "uppercase",
        },
        cityPickerEmpty: {
          paddingHorizontal: 14,
          paddingVertical: 20,
          alignItems: "center",
        },
        cityPickerEmptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
      }),
    [colors, insets.bottom, isDark],
  );

  const visibleRecommended = recommended.slice(0, visibleRecommendedCount);
  const canShowMoreRecommended = visibleRecommendedCount < recommended.length;

  return (
    <ShimmerProvider active={homeQueriesLoading}>
      <ScrollView
        style={stylesThemed.root}
        contentContainerStyle={[stylesThemed.content, { paddingTop: Math.max(insets.top, 12) }]}
      >
        <View style={stylesThemed.header}>
          <View style={stylesThemed.headerLeft}>
            <Pressable
              style={stylesThemed.aiBookingBtn}
              accessibilityRole="button"
              accessibilityLabel={t("home.a11y.openPixaiBooking")}
              onPress={() => navigation.navigate("AIBooking")}
            >
              <Ionicons name="sparkles" size={18} color={isDark ? "#0a0a0a" : "#ffffff"} />
            </Pressable>
          </View>
          <Text style={stylesThemed.logo}>Pixap</Text>
          <View style={stylesThemed.headerRight}>
            {unread > 0 ? (
              <View style={stylesThemed.badge}>
                <Text style={stylesThemed.badgeText}>{unread > 9 ? "9+" : unread}</Text>
              </View>
            ) : null}
            <Pressable
              style={stylesThemed.vibeMatchBtn}
              accessibilityRole="button"
              accessibilityLabel={t("home.a11y.openPixaiVibeMatch")}
              onPress={() => navigation.navigate("VibeMatch")}
            >
              <Ionicons name="color-filter" size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              style={stylesThemed.vibeMatchBtn}
              accessibilityRole="button"
              accessibilityLabel={t("language.choose")}
              onPress={() => setLanguageOpen(true)}
            >
              <Ionicons name="language-outline" size={20} color={colors.text} />
            </Pressable>
            <ThemeToggle />
          </View>
        </View>
        <LanguagePickerModal visible={languageOpen} onClose={() => setLanguageOpen(false)} />
        <Pressable
          style={stylesThemed.citySelector}
          onPress={() => {
            setCitySearchQuery("");
            setCityModalVisible(true);
          }}
        >
          <Text style={stylesThemed.citySelectorText}>
            {selectedCity === ALL_CITIES_OPTION ? t("home.allCities") : selectedCity}
          </Text>
        </Pressable>

        <Pressable style={stylesThemed.searchBtn} onPress={() => navigation.navigate("SearchMain")}>
          <Text style={stylesThemed.searchBtnText}>{t("home.searchPlaceholder")}</Text>
        </Pressable>

        <Text style={stylesThemed.sectionTitle}>{t("home.categories")}</Text>
        {lc ? (
          <CategorySkeletonRow />
        ) : (
          <FlatList
            horizontal
            style={stylesThemed.categoriesFlatList}
            data={categories}
            keyExtractor={(c) => c.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const iconSpec = resolveCategoryIconSpec(item.name);
              return (
                <Pressable style={stylesThemed.pill} onPress={() => navigation.navigate("Category", { id: item.id })}>
                  <View style={stylesThemed.pillContent}>
                    <View style={stylesThemed.pillIconWrap}>
                      <CategoryIcon spec={iconSpec} size={14} color={colors.primary} />
                    </View>
                    <Text style={stylesThemed.pillText}>{item.name}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        <View style={stylesThemed.sectionRow}>
          <Text style={stylesThemed.sectionTitle}>{t("home.featured")}</Text>
          <Pressable onPress={() => navigation.navigate("SearchMain")}>
            <Text style={stylesThemed.link}>{t("home.seeAll")}</Text>
          </Pressable>
        </View>
        {lf ? (
          <FeaturedSkeletonRow />
        ) : (
          <FlatList
            horizontal
            data={featured}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={stylesThemed.featuredCardWrap}>
                <BusinessPlaceCard
                  place={item}
                  variant="vertical"
                  colors={colors}
                  isDark={isDark}
                  onOpen={() => goPlace(item.id)}
                />
              </View>
            )}
          />
        )}

        <Text style={[stylesThemed.sectionTitle, { marginTop: 20 }]}>{t("home.recommended")}</Text>
        {lr ? (
          <RecommendedSkeletonList cardWidth={recommendedCardWidth} />
        ) : (
          <>
            {visibleRecommended.map((p) => (
              <View key={p.id} style={stylesThemed.recommendedGap}>
                <BusinessPlaceCard
                  place={p}
                  variant="horizontal"
                  colors={colors}
                  isDark={isDark}
                  onOpen={() => goPlace(p.id)}
                />
              </View>
            ))}
            {canShowMoreRecommended ? (
              <Pressable
                style={stylesThemed.showMoreBtn}
                onPress={() => setVisibleRecommendedCount((prev) => prev + RECOMMENDED_BATCH_SIZE)}
              >
                <Text style={stylesThemed.showMoreBtnText}>{t("home.showMore")}</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>

      <BottomSheetPickerModal
        visible={cityModalVisible}
        onClose={() => {
          setCitySearchQuery("");
          setCityModalVisible(false);
        }}
        title={t("home.chooseCity")}
        maxHeightFraction={0.72}
      >
        <View style={stylesThemed.citySearchBox}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={citySearchQuery}
            onChangeText={setCitySearchQuery}
            placeholder={t("home.citySearchPlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={stylesThemed.citySearchInput}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        {showAllCitiesOption ? (
          <Pressable
            key={ALL_CITIES_OPTION}
            style={stylesThemed.cityRow}
            onPress={() => void handleSelectCity(ALL_CITIES_OPTION)}
          >
            <Text style={stylesThemed.cityRowText}>{t("home.allCities")}</Text>
            {selectedCity === ALL_CITIES_OPTION ? <Text style={stylesThemed.cityCheck}>{t("home.selected")}</Text> : null}
          </Pressable>
        ) : null}

        {filteredCityGroups.map(({ country, cities }) => (
          <View key={country}>
            <View style={stylesThemed.countryHeader}>
              <Text style={stylesThemed.countryHeaderText}>{country}</Text>
            </View>
            {cities.map((city) => (
              <Pressable key={city} style={stylesThemed.cityRow} onPress={() => void handleSelectCity(city)}>
                <Text style={stylesThemed.cityRowText}>{city}</Text>
                {city === selectedCity ? <Text style={stylesThemed.cityCheck}>{t("home.selected")}</Text> : null}
              </Pressable>
            ))}
          </View>
        ))}

        {!showAllCitiesOption && filteredCityGroups.length === 0 ? (
          <View style={stylesThemed.cityPickerEmpty}>
            <Text style={stylesThemed.cityPickerEmptyText}>{t("home.noCitiesMatch")}</Text>
          </View>
        ) : null}
      </BottomSheetPickerModal>
    </ShimmerProvider>
  );
}
