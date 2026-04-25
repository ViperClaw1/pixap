import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, ScrollView, useWindowDimensions, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCards, useAvailableCities, ALL_CITIES_OPTION } from "@/hooks/useBusinessCards";
import { useCategories } from "@/hooks/useCategories";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import type { HomeStackParamList, RootTabParamList } from "@/navigation/types";
import { navigateToFeedTab } from "@/navigation/navigationHelpers";
import { useAppTheme } from "@/contexts/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";
import BusinessPlaceCard from "@/components/BusinessPlaceCard";
import {
  ShimmerProvider,
  CategorySkeletonRow,
  FeaturedSkeletonRow,
  RecommendedSkeletonList,
} from "@/components/shimmer";
import { BottomSheetPickerModal } from "@/components/BottomSheetPickerModal";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "HomeMain">,
  BottomTabNavigationProp<RootTabParamList>
>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [selectedCity, setSelectedCity] = useState(ALL_CITIES_OPTION);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const { data: availableCities = [ALL_CITIES_OPTION] } = useAvailableCities();
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

  const handleSelectCity = async (city: string) => {
    setCityModalVisible(false);
    if (city === selectedCity) return;
    const previous = selectedCity;
    setSelectedCity(city);
    try {
      await updateProfile.mutateAsync({ city: city === ALL_CITIES_OPTION ? null : city });
    } catch {
      setSelectedCity(previous);
      Alert.alert("Could not save city", "Please try again.");
    }
  };

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, paddingBottom: 24 },
        header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
        headerRight: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, justifyContent: "flex-end" },
        logo: { fontSize: 28, fontWeight: "800", color: colors.text },
        sub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        citySelector: {
          marginTop: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 10,
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
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          maxWidth: 200,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 20,
          backgroundColor: colors.notification,
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.35)",
          shadowColor: colors.notification,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.45 : 0.35,
          shadowRadius: 6,
          elevation: 5,
        },
        aiBookingBtnText: {
          flexShrink: 1,
          color: isDark ? "#0a0a0a" : "#ffffff",
          fontSize: 12,
          fontWeight: "800",
          letterSpacing: 0.2,
        },
        searchBtn: {
          backgroundColor: colors.border,
          padding: 14,
          borderRadius: 12,
          marginBottom: 20,
        },
        searchBtnText: { color: colors.textMuted, fontSize: 14 },
        sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 10, color: colors.text },
        sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
        link: { fontSize: 12, color: colors.link, fontWeight: "600" },
        pill: {
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: colors.card,
          borderRadius: 20,
          marginRight: 8,
          borderWidth: 1,
          borderColor: colors.border,
        },
        pillText: { color: colors.text },
        categoriesFlatList: { marginBottom: 12 },
        featuredCardWrap: { marginRight: 12 },
        recommendedGap: { marginBottom: 12 },
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
      }),
    [colors, insets.bottom, isDark],
  );

  return (
    <ShimmerProvider active={homeQueriesLoading}>
      <ScrollView
        style={stylesThemed.root}
        contentContainerStyle={[stylesThemed.content, { paddingTop: Math.max(insets.top, 12) }]}
      >
        <View style={stylesThemed.header}>
          <View>
            <Text style={stylesThemed.logo}>Pixap</Text>
            <Pressable style={stylesThemed.citySelector} onPress={() => setCityModalVisible(true)}>
              <Text style={stylesThemed.citySelectorText}>{selectedCity}</Text>
            </Pressable>
          </View>
          <View style={stylesThemed.headerRight}>
            {unread > 0 ? (
              <View style={stylesThemed.badge}>
                <Text style={stylesThemed.badgeText}>{unread > 9 ? "9+" : unread}</Text>
              </View>
            ) : null}
            <Pressable
              style={stylesThemed.aiBookingBtn}
              accessibilityRole="button"
              accessibilityLabel="Open PixAI Smart Booking"
              onPress={() => navigation.navigate("AIBooking")}
            >
              <Ionicons name="sparkles" size={18} color={isDark ? "#0a0a0a" : "#ffffff"} />
              <Text style={stylesThemed.aiBookingBtnText} numberOfLines={1}>
                PixAI Smart Booking
              </Text>
            </Pressable>
            <ThemeToggle />
          </View>
        </View>

        <Pressable style={stylesThemed.searchBtn} onPress={() => navigateToFeedTab(navigation)}>
          <Text style={stylesThemed.searchBtnText}>Search restaurants, salons, events…</Text>
        </Pressable>

        <Text style={stylesThemed.sectionTitle}>Categories</Text>
        {lc ? (
          <CategorySkeletonRow />
        ) : (
          <FlatList
            horizontal
            style={stylesThemed.categoriesFlatList}
            data={categories}
            keyExtractor={(c) => c.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable style={stylesThemed.pill} onPress={() => navigation.navigate("Category", { id: item.id })}>
                <Text style={stylesThemed.pillText}>
                  {item.icon} {item.name}
                </Text>
              </Pressable>
            )}
          />
        )}

        <View style={stylesThemed.sectionRow}>
          <Text style={stylesThemed.sectionTitle}>Featured</Text>
          <Pressable onPress={() => navigateToFeedTab(navigation)}>
            <Text style={stylesThemed.link}>See all</Text>
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

        <Text style={[stylesThemed.sectionTitle, { marginTop: 20 }]}>Recommended</Text>
        {lr ? (
          <RecommendedSkeletonList cardWidth={recommendedCardWidth} />
        ) : (
          recommended.map((p) => (
            <View key={p.id} style={stylesThemed.recommendedGap}>
              <BusinessPlaceCard
                place={p}
                variant="horizontal"
                colors={colors}
                isDark={isDark}
                onOpen={() => goPlace(p.id)}
              />
            </View>
          ))
        )}
      </ScrollView>

      <BottomSheetPickerModal
        visible={cityModalVisible}
        onClose={() => setCityModalVisible(false)}
        title="Choose city"
      >
        {availableCities.map((city) => (
          <Pressable key={city} style={stylesThemed.cityRow} onPress={() => void handleSelectCity(city)}>
            <Text style={stylesThemed.cityRowText}>{city}</Text>
            {city === selectedCity ? <Text style={stylesThemed.cityCheck}>Selected</Text> : null}
          </Pressable>
        ))}
      </BottomSheetPickerModal>
    </ShimmerProvider>
  );
}
