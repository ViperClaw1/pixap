import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { InteractionManager, Text, View, ScrollView } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { AppPressable } from "@/shared/ui/app-pressable";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCardsByCategory } from "@/entities/business-card";
import { useProfile } from "@/entities/user";
import { useCategories } from "@/entities/category";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { getPrimaryBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrl,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
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
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { ShimmerProvider, PlaceRowSkeletonList } from "@/shared/ui/shimmer";

const PLACE_CARD_MAX_TAGS = 4;

type R = RouteProp<BrowseFlowParamList, "Category">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "Category">;

export default function CategoryScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const navigateOnce = useNavigateOnce();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { data: profile } = useProfile();
  const profileCity = profile?.city?.trim() || null;
  const { data = [], isLoading } = useBusinessCardsByCategory(id, profileCity);
  const { data: categories = [] } = useCategories();
  const categoryName = categories.find((category) => category.id === id)?.name ?? t("category.fallbackName");
  const [visibleCount, setVisibleCount] = useState(PLACE_LIST_BATCH_SIZE);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setVisibleCount(PLACE_LIST_BATCH_SIZE);
    });
    return () => task.cancel();
  }, [data, id]);

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
  const emptyMessage = profileCity
    ? t("category.noPlacesInCity", { city: profileCity })
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

  const listFooter = useMemo(
    () =>
      !isLoading && canShowMore ? (
        <AppPressable style={styles.showMoreBtn} onPress={() => setVisibleCount((prev) => prev + PLACE_LIST_BATCH_SIZE)}>
          <Text style={styles.showMoreBtnText}>{t("home.showMore")}</Text>
        </AppPressable>
      ) : null,
    [canShowMore, isLoading, styles.showMoreBtn, styles.showMoreBtnText, t],
  );

  const renderPlaceRow = useCallback<ListRenderItem<(typeof visiblePlaces)[number]>>(
    ({ item }) => {
      const visibleTags = (item.tags ?? []).slice(0, PLACE_CARD_MAX_TAGS);
      const heroRaw = getPrimaryBusinessCardImage(item.images);
      const heroDisplay = getBusinessCardDisplayUrl(heroRaw, { size: "list" });
      const coverBlurhash = getBusinessCardCoverBlurhash(item.blurhashes);
      return (
        <AppPressable
          style={styles.row}
          onPressIn={() => handlePlacePressIn(item.id)}
          onPress={() => handlePlacePress(item.id)}
        >
          <SmartImage
            uri={heroDisplay}
            fallbackUri={businessCardDisplayFallback(heroDisplay, heroRaw)}
            blurhash={coverBlurhash}
            bundledFallback={PLACE_IMAGE_FALLBACK}
            recyclingKey={item.id}
            style={categoryStaticStyles.img}
            contentFit="cover"
          />
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
    },
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
