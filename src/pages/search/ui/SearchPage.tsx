import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCards, type BusinessCard } from "@/entities/business-card";
import { useProfile } from "@/entities/user";
import type { SearchStackParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { getLatestBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { PLACE_LIST_BATCH_SIZE } from "@/shared/lib/placeListBatchSize";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { ShimmerProvider, PlaceRowSkeletonList } from "@/shared/ui/shimmer";
import { searchStaticStyles, searchThemeStyles } from "./searchStyles";

type Nav = NativeStackNavigationProp<SearchStackParamList, "SearchMain">;

const PLACE_CARD_MAX_TAGS = 3;

type SearchPlaceRowProps = {
  item: BusinessCard;
  styles: ReturnType<typeof mergeStaticAndThemed<typeof searchStaticStyles>>;
  onPress: (id: string) => void;
};

function SearchPlaceRow({ item, styles, onPress }: SearchPlaceRowProps) {
  const visibleTags = (item.tags ?? []).slice(0, PLACE_CARD_MAX_TAGS);

  return (
    <Pressable style={styles.row} onPress={() => onPress(item.id)}>
      <SmartImage
        uri={getOptimizedImageUrl(getLatestBusinessCardImage(item.images), 168, 168, 72)}
        fallbackUri={getLatestBusinessCardImage(item.images)}
        bundledFallback={PLACE_IMAGE_FALLBACK}
        recyclingKey={item.id}
        style={styles.thumb}
        contentFit="cover"
      />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.address?.trim() ? (
          <Text style={styles.meta} numberOfLines={1}>
            {item.address.trim()}
          </Text>
        ) : null}
        {visibleTags.length > 0 ? (
          <View style={styles.tagsRow}>
            {visibleTags.map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagText} numberOfLines={1}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useAppTheme();
  const toggleThemeMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };
  const { data: profile } = useProfile();
  const profileCity = profile?.city?.trim() || null;
  const { data: places = [], isLoading } = useBusinessCards(undefined, profileCity);
  const [q, setQ] = useState("");
  const [visibleCount, setVisibleCount] = useState(PLACE_LIST_BATCH_SIZE);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return places;
    return places.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.tags.some((tag) => tag.toLowerCase().includes(s)) ||
        (p.description ?? "").toLowerCase().includes(s),
    );
  }, [places, q]);

  useEffect(() => {
    setVisibleCount(PLACE_LIST_BATCH_SIZE);
  }, [places]);

  const visibleFiltered = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const canShowMore = visibleCount < filtered.length;
  const showEmptyState = !isLoading && q.trim().length > 0 && filtered.length === 0;

  const themed = useThemeStyles(({ colors: c, isDark: dark }) => searchThemeStyles(c, dark));
  const styles = useMemo(() => mergeStaticAndThemed(searchStaticStyles, themed), [themed]);

  const listContentPadding = useMemo(
    () => ({
      flexGrow: showEmptyState ? 1 : undefined,
      paddingBottom: 100 + insets.bottom,
    }),
    [insets.bottom, showEmptyState],
  );

  const handleQueryChange = useCallback((text: string) => {
    setQ(text);
    setVisibleCount(PLACE_LIST_BATCH_SIZE);
  }, []);

  const clearQuery = useCallback(() => {
    setQ("");
    setVisibleCount(PLACE_LIST_BATCH_SIZE);
  }, []);

  const openPlace = useCallback(
    (id: string) => {
      navigation.navigate("PlaceDetail", { id });
    },
    [navigation],
  );

  const listFooter = useMemo(
    () =>
      !isLoading && canShowMore ? (
        <Pressable
          style={styles.showMoreBtn}
          onPress={() => setVisibleCount((prev) => prev + PLACE_LIST_BATCH_SIZE)}
        >
          <Text style={styles.showMoreBtnText}>{t("home.showMore")}</Text>
        </Pressable>
      ) : null,
    [canShowMore, isLoading, styles.showMoreBtn, styles.showMoreBtnText, t],
  );

  return (
    <View style={styles.root} {...androidSwipeBackPanHandlers}>
      <AppHeader
        title={t("header.search")}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        rightIcon={mode === "dark" ? "sunny-outline" : "moon-outline"}
        onRightPress={toggleThemeMode}
      />
      <View style={styles.content}>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder={t("search.placeholder")}
          value={q}
          onChangeText={handleQueryChange}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {q.length > 0 ? (
          <Pressable
            style={styles.clearBtn}
            onPress={clearQuery}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <ShimmerProvider active>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={listContentPadding}>
            <PlaceRowSkeletonList variant="search" />
          </ScrollView>
        </ShimmerProvider>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={listContentPadding}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {showEmptyState ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t("search.noMatchingPlaces", "No matching places")}</Text>
            </View>
          ) : (
            visibleFiltered.map((item) => (
              <SearchPlaceRow key={item.id} item={item} styles={styles} onPress={openPlace} />
            ))
          )}
          {!showEmptyState ? listFooter : null}
        </ScrollView>
      )}
      </View>
    </View>
  );
}
