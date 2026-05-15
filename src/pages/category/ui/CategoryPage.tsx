import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCardsByCategory } from "@/entities/business-card";
import { useCategories } from "@/entities/category";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { getLatestBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import ThemeToggle from "@/shared/ui/theme-toggle/ThemeToggle";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { categoryStaticStyles, categoryThemeStyles } from "./categoryStyles";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";

const PLACE_CARD_MAX_TAGS = 4;

type R = RouteProp<BrowseFlowParamList, "Category">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "Category">;

export default function CategoryScreen() {
  const { t } = useTranslation();
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { data = [], isLoading } = useBusinessCardsByCategory(id);
  const { data: categories = [] } = useCategories();
  const categoryName = categories.find((category) => category.id === id)?.name ?? t("category.fallbackName");

  const themed = useThemeStyles(
    ({ colors: c, isDark: dark }) => categoryThemeStyles(c, dark, insets.bottom),
    [insets.bottom],
  );
  const styles = useMemo(
    () => mergeStaticAndThemed(categoryStaticStyles, themed),
    [themed],
  );

  const renderPlaceRow = useCallback<ListRenderItem<(typeof data)[number]>>(
    ({ item }) => {
      const visibleTags = (item.tags ?? []).slice(0, PLACE_CARD_MAX_TAGS);
      return (
        <Pressable style={styles.row} onPress={() => navigation.navigate("PlaceDetail", { id: item.id })}>
          <SmartImage
            uri={getLatestBusinessCardImage(item.images)}
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
        </Pressable>
      );
    },
    [navigation, styles],
  );

  return (
    <View style={styles.root} {...androidSwipeBackPanHandlers}>
      <View style={[styles.list, { paddingTop: Math.max(insets.top, 12), paddingBottom: 0 }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable style={styles.headerBackBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
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
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlashList
          data={data}
          keyExtractor={(p) => p.id}
          estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.categoryPlace}
          contentContainerStyle={[styles.list, { paddingTop: 0 }]}
          renderItem={renderPlaceRow}
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
