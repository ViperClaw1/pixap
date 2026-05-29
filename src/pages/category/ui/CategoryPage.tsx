import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { InteractionManager, PixelRatio, StyleSheet, Text, View, ScrollView } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { AppPressable } from "@/shared/ui/app-pressable";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCardsByCategory } from "@/entities/business-card";
import { useCategories } from "@/entities/category";
import { CityPickerField, useProfileCityPicker } from "@/shared/ui/city-picker";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { getBusinessCardThumbUris } from "@/shared/lib/business-card/businessCardDisplayUrl";
import { getBusinessCardCoverBlurhash } from "@/shared/lib/business-card/businessCardBlurhash";
import { useNavigateOnce } from "@/shared/lib/navigation/useNavigateOnce";
import { prefetchBusinessCard } from "@/shared/lib/navigation/prefetchBusinessCard";
import ThemeToggle from "@/shared/ui/theme-toggle/ThemeToggle";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { categoryStaticStyles, categoryThemeStyles } from "./categoryStyles";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import { PLACE_LIST_BATCH_SIZE } from "@/shared/lib/placeListBatchSize";
import { useExpandVisibleBatch } from "@/shared/lib/useExpandVisibleBatch";
import { ShowMoreButton } from "@/shared/ui/show-more-button";
import { ShimmerProvider, PlaceRowSkeletonList } from "@/shared/ui/shimmer";

const PLACE_CARD_MAX_TAGS = 4;
const CATEGORY_THUMB_SIZE = 80;

type R = RouteProp<BrowseFlowParamList, "Category">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "Category">;

type CategoryPlace = {
  id: string;
  name: string;
  address: string;
  tags: string[];
  images: string[];
  image?: string | null;
  blurhashes?: string[];
};

type CategoryPlaceRowProps = {
  item: CategoryPlace;
  styles: ReturnType<typeof mergeStaticAndThemed<typeof categoryStaticStyles>>;
  onPressIn: (placeId: string) => void;
  onPress: (placeId: string) => void;
};

function CategoryPlaceRow({ item, styles, onPressIn, onPress }: CategoryPlaceRowProps) {
  const { colors } = useAppTheme();
  const visibleTags = (item.tags ?? []).slice(0, PLACE_CARD_MAX_TAGS);
  const thumbDpr = Math.min(2, PixelRatio.get());
  const thumb = getBusinessCardThumbUris(item, {
    layoutPx: CATEGORY_THUMB_SIZE * thumbDpr,
    layoutPxHeight: CATEGORY_THUMB_SIZE * thumbDpr,
  });
  const coverBlurhash = getBusinessCardCoverBlurhash(item.blurhashes);
  const thumbFrameStyle = useMemo(
    () => [
      categoryStaticStyles.img,
      !coverBlurhash ? { backgroundColor: colors.tagMuted } : null,
    ],
    [colors.tagMuted, coverBlurhash],
  );

  return (
    <AppPressable
      style={styles.row}
      onPressIn={() => onPressIn(item.id)}
      onPress={() => onPress(item.id)}
    >
      <View style={thumbFrameStyle}>
        <SmartImage
          uri={thumb.uri}
          fallbackUri={thumb.fallbackUri}
          blurhash={coverBlurhash}
          skipBundledPlaceholder
          recyclingKey={`${item.id}:${thumb.raw ?? "no-image"}:${coverBlurhash ?? ""}`}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={0}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.address?.trim() ? (
          <Text style={styles.address} numberOfLines={2}>
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

export default function CategoryScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const navigateOnce = useNavigateOnce();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { selectedCity, profileCityFilter, selectCity } = useProfileCityPicker();
  const { data = [], isLoading } = useBusinessCardsByCategory(id, profileCityFilter);
  const { data: categories = [] } = useCategories();
  const categoryName = categories.find((category) => category.id === id)?.name ?? t("category.fallbackName");
  const [visibleCount, setVisibleCount] = useState(PLACE_LIST_BATCH_SIZE);
  const { isLoadingMore, expand: expandVisibleBatch } = useExpandVisibleBatch();

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setVisibleCount(PLACE_LIST_BATCH_SIZE);
    });
    return () => task.cancel();
  }, [data, id, profileCityFilter]);

  const visiblePlaces = useMemo(() => data.slice(0, visibleCount), [data, visibleCount]);
  const canShowMore = visibleCount < data.length;
  const listExtraData = useMemo(
    () =>
      visiblePlaces
        .map((p) => `${p.id}:${getBusinessCardCoverBlurhash(p.blurhashes) ?? ""}`)
        .join("|"),
    [visiblePlaces],
  );
  const showEmptyState = !isLoading && data.length === 0;
  const emptyMessage = profileCityFilter
    ? t("category.noPlacesInCity", { city: profileCityFilter })
    : t("category.noPlaces");

  const themed = useThemeStyles(
    ({ colors: c, isDark: dark }) => categoryThemeStyles(c, dark, insets.bottom),
    [insets.bottom],
  );
  const styles = useMemo(
    () => mergeStaticAndThemed(categoryStaticStyles, themed),
    [themed],
  );

  const openPlaceDetailRef = useRef<(placeId: string) => void>(() => undefined);
  openPlaceDetailRef.current = (placeId: string) => {
    navigateOnce(() => navigation.navigate("PlaceDetail", { id: placeId }));
  };

  const prefetchPlaceRef = useRef<(placeId: string) => void>(() => undefined);
  prefetchPlaceRef.current = (placeId: string) => {
    void prefetchBusinessCard(queryClient, placeId, i18n.language);
  };

  const handlePlacePressIn = useCallback((placeId: string) => {
    prefetchPlaceRef.current(placeId);
  }, []);

  const handlePlacePress = useCallback((placeId: string) => {
    openPlaceDetailRef.current(placeId);
  }, []);

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

  const renderPlaceRow = useCallback<ListRenderItem<(typeof visiblePlaces)[number]>>(
    ({ item }) => (
      <CategoryPlaceRow
        item={item}
        styles={styles}
        onPressIn={handlePlacePressIn}
        onPress={handlePlacePress}
      />
    ),
    [handlePlacePress, handlePlacePressIn, styles],
  );

  return (
    <View style={styles.root} {...androidSwipeBackPanHandlers}>
      <View style={[styles.list, { paddingTop: Math.max(insets.top, 12), paddingBottom: 0 }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AppPressable style={styles.headerBackBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </AppPressable>
          </View>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {categoryName}
          </Text>
          <View style={styles.headerRight}>
            <ThemeToggle />
          </View>
        </View>
        <View style={styles.cityRow}>
          <CityPickerField value={selectedCity} onChange={selectCity} />
        </View>
      </View>

      {isLoading ? (
        <ShimmerProvider active>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.list, { paddingTop: 0 }]}>
            <PlaceRowSkeletonList variant="category" />
          </ScrollView>
        </ShimmerProvider>
      ) : showEmptyState ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <FlashList
          data={visiblePlaces}
          extraData={listExtraData}
          keyExtractor={(p) => p.id}
          estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.categoryPlace}
          contentContainerStyle={[styles.list, { paddingTop: 0 }]}
          renderItem={renderPlaceRow}
          ListFooterComponent={listFooter}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={8}
          updateCellsBatchingPeriod={40}
        />
      )}
    </View>
  );
}
