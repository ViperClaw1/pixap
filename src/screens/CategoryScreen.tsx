import { useMemo } from "react";
import { FlatList, Pressable, Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCardsByCategory } from "@/hooks/useBusinessCards";
import type { BrowseFlowParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import { getLatestBusinessCardImage } from "@/lib/businessCardImages";

type R = RouteProp<BrowseFlowParamList, "Category">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "Category">;

export default function CategoryScreen() {
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { data = [], isLoading } = useBusinessCardsByCategory(id);

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
        list: { padding: 16, paddingBottom: 40 + insets.bottom },
        row: {
          flexDirection: "row",
          gap: 12,
          marginBottom: 16,
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 8,
          borderWidth: 1,
          borderColor: colors.border,
        },
        name: { fontWeight: "700", fontSize: 16, color: colors.text },
        meta: { marginTop: 4, color: colors.textMuted },
      }),
    [colors, insets.bottom],
  );

  if (isLoading) {
    return (
      <View style={stylesThemed.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(p) => p.id}
      contentContainerStyle={[stylesThemed.list, { paddingTop: Math.max(insets.top, 12) }]}
      renderItem={({ item }) => (
        <Pressable style={stylesThemed.row} onPress={() => navigation.navigate("PlaceDetail", { id: item.id })}>
          <SmartImage uri={getLatestBusinessCardImage(item.images)} recyclingKey={item.id} style={styles.img} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={stylesThemed.name}>{item.name}</Text>
            <Text style={stylesThemed.meta}>{Number(item.booking_price).toLocaleString()} ₸</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  img: { width: 80, height: 80, borderRadius: 8 },
});
