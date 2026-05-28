import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/app/providers/AuthProvider";
import { useFavorites } from "@/entities/favorite";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import { getPrimaryBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrl,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { favoritesStaticStyles, favoritesThemeStyles } from "./favoritesStyles";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "Favorites">;

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useAppTheme();
  const toggleThemeMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  const { user, loading } = useAuth();
  const { data: favorites = [] } = useFavorites();

  useEffect(() => {
    if (!loading && !user) {
      navigation.navigate("Auth");
    }
  }, [loading, user, navigation]);

  const themed = useThemeStyles(({ colors: c }) => favoritesThemeStyles(c));
  const styles = useMemo(
    () => mergeStaticAndThemed(favoritesStaticStyles, themed),
    [themed],
  );

  const renderFavoriteItem = useCallback(
    ({ item }: { item: (typeof favorites)[number] }) => {
      const b = item.business_card as { id: string; name: string; images: string[] | null; address: string } | null;
      if (!b) return null;
      const heroRaw = getPrimaryBusinessCardImage(b.images);
      const heroDisplay = getBusinessCardDisplayUrl(heroRaw, { layoutPx: 168, layoutPxHeight: 168 });
      return (
        <Pressable style={styles.row} onPress={() => navigation.navigate("PlaceDetail", { id: b.id })}>
          <SmartImage
            uri={heroDisplay}
            fallbackUri={businessCardDisplayFallback(heroDisplay, heroRaw)}
            recyclingKey={b.id}
            style={styles.thumb}
            contentFit="cover"
            skipBundledPlaceholder
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{b.name}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {b.address}
            </Text>
          </View>
        </Pressable>
      );
    },
    [navigation, styles.meta, styles.name, styles.row, styles.thumb],
  );

  if (!loading && !user) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} {...androidSwipeBackPanHandlers}>
    <FlashList
      data={favorites}
      estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.placeRow}
      keyExtractor={(f) => `${f.user_id}-${f.business_card_id}`}
      ListHeaderComponent={
      <AppHeader
        title={t("header.favorites")}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        rightIcon={mode === "dark" ? "sunny-outline" : "moon-outline"}
        onRightPress={toggleThemeMode}
        notificationsEnabled
      />
      }
      contentContainerStyle={{
        padding: 16,
        paddingTop: 12,
        paddingBottom: 100 + insets.bottom,
      }}
      ListEmptyComponent={<Text style={styles.empty}>{t("favorites.empty")}</Text>}
      renderItem={renderFavoriteItem}
      removeClippedSubviews
      initialNumToRender={8}
      maxToRenderPerBatch={10}
      windowSize={8}
      updateCellsBatchingPeriod={40}
    />
    </View>
  );
}

