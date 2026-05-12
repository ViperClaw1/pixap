import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, Text, View, StyleSheet } from "react-native";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/entities/favorite";
import type { ProfileStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import { getLatestBusinessCardImage } from "@/lib/businessCardImages";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";

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

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          gap: 12,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        name: { fontWeight: "700", color: colors.text },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        empty: { textAlign: "center", color: colors.textMuted, marginTop: 32 },
      }),
    [colors],
  );

  if (!loading && !user) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} {...androidSwipeBackPanHandlers}>
    <FlatList
      data={favorites}
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
      ListEmptyComponent={<Text style={stylesThemed.empty}>{t("favorites.empty")}</Text>}
      renderItem={({ item }) => {
        const b = item.business_card as { id: string; name: string; images: string[] | null; address: string } | null;
        if (!b) return null;
        return (
          <Pressable style={stylesThemed.row} onPress={() => navigation.navigate("PlaceDetail", { id: b.id })}>
            <SmartImage
              uri={getOptimizedImageUrl(getLatestBusinessCardImage(b.images), 168, 168, 72)}
              fallbackUri={getLatestBusinessCardImage(b.images)}
              recyclingKey={b.id}
              style={styles.thumb}
              contentFit="cover"
              skipBundledPlaceholder
            />
            <View style={{ flex: 1 }}>
              <Text style={stylesThemed.name}>{b.name}</Text>
              <Text style={stylesThemed.meta} numberOfLines={1}>
                {b.address}
              </Text>
            </View>
          </Pressable>
        );
      }}
      removeClippedSubviews
      initialNumToRender={8}
      maxToRenderPerBatch={10}
      windowSize={8}
      updateCellsBatchingPeriod={40}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 56, height: 56, borderRadius: 8 },
});
