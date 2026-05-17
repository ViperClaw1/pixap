import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCards } from "@/entities/business-card";
import type { SearchStackParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
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

export default function SearchScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { data: places = [], isLoading } = useBusinessCards();
  const [q, setQ] = useState("");
  const [visibleCount, setVisibleCount] = useState(PLACE_LIST_BATCH_SIZE);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return places;
    return places.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.tags.some((t) => t.toLowerCase().includes(s)) ||
        (p.description ?? "").toLowerCase().includes(s),
    );
  }, [places, q]);

  useEffect(() => {
    setVisibleCount(PLACE_LIST_BATCH_SIZE);
  }, [places, q]);

  const visibleFiltered = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const canShowMore = visibleCount < filtered.length;

  const themed = useThemeStyles(({ colors: c, isDark: dark }) => searchThemeStyles(c, dark));
  const styles = useMemo(() => mergeStaticAndThemed(searchStaticStyles, themed), [themed]);

  const listContentPadding = useMemo(
    () => ({ paddingBottom: 100 + insets.bottom }),
    [insets.bottom],
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

  const renderSearchItem = useCallback<ListRenderItem<(typeof visibleFiltered)[number]>>(
    (info) => {
      const item = info.item;
      const visibleTags = (item.tags ?? []).slice(0, PLACE_CARD_MAX_TAGS);
      return (
        <Pressable style={styles.row} onPress={() => navigation.navigate("PlaceDetail", { id: item.id })}>
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
    },
    [navigation, styles],
  );

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]} {...androidSwipeBackPanHandlers}>
      <TextInput
        style={styles.input}
        placeholder={t("search.placeholder")}
        value={q}
        onChangeText={setQ}
        placeholderTextColor={colors.textMuted}
      />
      {isLoading ? (
        <ShimmerProvider active>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={listContentPadding}>
            <PlaceRowSkeletonList variant="search" />
          </ScrollView>
        </ShimmerProvider>
      ) : (
        <FlashList
          data={visibleFiltered}
          keyExtractor={(p) => p.id}
          estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.placeRow}
          contentContainerStyle={listContentPadding}
          renderItem={renderSearchItem}
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

