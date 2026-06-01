import { AppPressable } from "@/shared/ui/app-pressable";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View, Text, TextInput, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useBusinessCards, type BusinessCard } from "@/entities/business-card";
import { CityPickerField, useProfileCityPicker } from "@/shared/ui/city-picker";
import type { SearchStackParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { getPrimaryBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrl,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
import { getBusinessCardCoverBlurhash } from "@/shared/lib/business-card/businessCardBlurhash";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { PLACE_LIST_BATCH_SIZE } from "@/shared/lib/placeListBatchSize";
import { useExpandVisibleBatch } from "@/shared/lib/useExpandVisibleBatch";
import { ShowMoreButton } from "@/shared/ui/show-more-button";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { ShimmerProvider, PlaceRowSkeletonList } from "@/shared/ui/shimmer";
import { prefetchBusinessCard } from "@/shared/lib/navigation/prefetchBusinessCard";
import { useNavigationGuard } from "@/shared/lib/navigation/useNavigationGuard";
import { searchStaticStyles, searchThemeStyles } from "./searchStyles";

type Nav = NativeStackNavigationProp<SearchStackParamList, "SearchMain">;

const PLACE_CARD_MAX_TAGS = 3;

type SearchPlaceRowProps = {
  item: BusinessCard;
  styles: ReturnType<typeof mergeStaticAndThemed<typeof searchStaticStyles>>;
  onPressIn: (id: string) => void;
  onPress: (id: string) => void;
};

function SearchPlaceRow({ item, styles, onPressIn, onPress }: SearchPlaceRowProps) {
  const visibleTags = (item.tags ?? []).slice(0, PLACE_CARD_MAX_TAGS);
  const heroRaw = getPrimaryBusinessCardImage(item.images);
  const heroDisplay = getBusinessCardDisplayUrl(heroRaw, { layoutPx: 168, layoutPxHeight: 168 });
  const coverBlurhash = getBusinessCardCoverBlurhash(item.blurhashes);

  return (
    <AppPressable
      style={styles.row}
      onPressIn={() => onPressIn(item.id)}
      onPress={() => onPress(item.id)}
    >
      <SmartImage
        uri={heroDisplay}
        fallbackUri={businessCardDisplayFallback(heroDisplay, heroRaw)}
        blurhash={coverBlurhash}
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
    </AppPressable>
  );
}

export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const { guardedNavigate } = useNavigationGuard();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const { colors, mode, setMode } = useAppTheme();
  const toggleThemeMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };
  const { selectedCity, profileCityFilter, selectCity } = useProfileCityPicker();
  const { data: places = [], isLoading } = useBusinessCards(undefined, selectedCity);
  const [q, setQ] = useState("");
  const [visibleCount, setVisibleCount] = useState(PLACE_LIST_BATCH_SIZE);
  const { isLoadingMore, expand: expandVisibleBatch } = useExpandVisibleBatch();

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
  }, [places, profileCityFilter]);

  const visibleFiltered = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const canShowMore = visibleCount < filtered.length;
  const showEmptyState = !isLoading && q.trim().length > 0 && filtered.length === 0;

  const themed = useThemeStyles(({ colors: c, isDark: dark }) => searchThemeStyles(c, dark));
  const styles = useMemo(() => mergeStaticAndThemed(searchStaticStyles, themed), [themed]);

  const handleQueryChange = useCallback((text: string) => {
    setQ(text);
    setVisibleCount(PLACE_LIST_BATCH_SIZE);
  }, []);

  const clearQuery = useCallback(() => {
    setQ("");
    setVisibleCount(PLACE_LIST_BATCH_SIZE);
  }, []);

  const handleResultPressIn = useCallback(
    (placeId: string) => {
      void prefetchBusinessCard(queryClient, placeId, i18n.language);
    },
    [i18n.language, queryClient],
  );

  const openPlace = useCallback(
    (id: string) => {
      guardedNavigate("PlaceDetail", { id });
    },
    [guardedNavigate],
  );

  const handleShowMore = useCallback(() => {
    expandVisibleBatch(() => {
      setVisibleCount((prev) => prev + PLACE_LIST_BATCH_SIZE);
    });
  }, [expandVisibleBatch]);

  const listFooter = useMemo(
    () =>
      !isLoading && (canShowMore || isLoadingMore) ? (
        <ShowMoreButton
          label={t("home.showMore")}
          loading={isLoadingMore}
          onPress={handleShowMore}
          style={styles.showMoreBtn}
          textStyle={styles.showMoreBtnText}
          spinnerColor={colors.onAccent}
        />
      ) : null,
    [canShowMore, colors.onAccent, handleShowMore, isLoading, isLoadingMore, styles.showMoreBtn, styles.showMoreBtnText, t],
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
      <View style={styles.cityRow}>
        <CityPickerField value={selectedCity} onChange={selectCity} />
      </View>
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
          <AppPressable
            style={styles.clearBtn}
            onPress={clearQuery}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </AppPressable>
        ) : null}
      </View>

      {isLoading ? (
        <ShimmerProvider active>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            <PlaceRowSkeletonList variant="search" />
          </ScrollView>
        </ShimmerProvider>
      ) : (
        <ScrollView
          style={styles.list}
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
              <SearchPlaceRow
                key={item.id}
                item={item}
                styles={styles}
                onPressIn={handleResultPressIn}
                onPress={openPlace}
              />
            ))
          )}
          {!showEmptyState ? listFooter : null}
        </ScrollView>
      )}
      </View>
    </View>
  );
}
