import { useEffect, useMemo } from "react";
import { FlatList, Pressable, Text, View, StyleSheet } from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import type { ProfileStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import { getLatestBusinessCardImage } from "@/lib/businessCardImages";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "Favorites">;

export default function FavoritesScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
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
    <FlatList
      data={favorites}
      keyExtractor={(f) => `${f.user_id}-${f.business_card_id}`}
      contentContainerStyle={{
        padding: 16,
        paddingTop: Math.max(insets.top, 12),
        paddingBottom: 100 + insets.bottom,
      }}
      ListEmptyComponent={<Text style={stylesThemed.empty}>No favorites yet</Text>}
      renderItem={({ item }) => {
        const b = item.business_card as { id: string; name: string; images: string[] | null; address: string } | null;
        if (!b) return null;
        return (
          <Pressable style={stylesThemed.row} onPress={() => navigation.navigate("PlaceDetail", { id: b.id })}>
            <SmartImage uri={getLatestBusinessCardImage(b.images)} recyclingKey={b.id} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={stylesThemed.name}>{b.name}</Text>
              <Text style={stylesThemed.meta} numberOfLines={1}>
                {b.address}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  thumb: { width: 56, height: 56, borderRadius: 8 },
});
