import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/app/providers/AuthProvider";
import { useFavorites } from "@/entities/favorite";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { FavoritePlaceRow } from "./FavoritePlaceRow";
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

  const listContentPaddingBottom = 100 + insets.bottom;
  const showEmptyList = favorites.length === 0;

  const listContentStyle = useMemo(
    () => [
      { padding: 16, paddingTop: 12, paddingBottom: listContentPaddingBottom },
      showEmptyList ? styles.listContentEmpty : null,
    ],
    [listContentPaddingBottom, showEmptyList, styles.listContentEmpty],
  );

  const openPlaceDetail = useCallback(
    (placeId: string) => {
      navigation.navigate("PlaceDetail", { id: placeId });
    },
    [navigation],
  );

  const renderFavoriteItem = useCallback(
    ({ item }: { item: (typeof favorites)[number] }) => (
      <FavoritePlaceRow item={item} styles={styles} onOpen={openPlaceDetail} />
    ),
    [openPlaceDetail, styles],
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
      contentContainerStyle={listContentStyle}
      ListEmptyComponent={
        <View style={styles.emptyListWrap}>
          <Text style={styles.empty}>{t("favorites.empty")}</Text>
        </View>
      }
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

