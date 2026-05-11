import { useMemo } from "react";
import { FlatList, Pressable, Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCardsByCategory } from "@/entities/business-card";
import { useCategories } from "@/entities/category";
import type { BrowseFlowParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import { getLatestBusinessCardImage } from "@/lib/businessCardImages";
import ThemeToggle from "@/shared/ui/theme-toggle/ThemeToggle";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";

type R = RouteProp<BrowseFlowParamList, "Category">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "Category">;

export default function CategoryScreen() {
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { data = [], isLoading } = useBusinessCardsByCategory(id);
  const { data: categories = [] } = useCategories();
  const categoryName = categories.find((category) => category.id === id)?.name ?? "Category";

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
        root: { flex: 1, backgroundColor: colors.background },
        list: { padding: 16, paddingBottom: 40 + insets.bottom },
        header: {
          minHeight: 46,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        },
        headerLeft: { flexDirection: "row", alignItems: "center", zIndex: 1 },
        headerRight: { flexDirection: "row", alignItems: "center", zIndex: 1 },
        headerBackBtn: {
          width: 40,
          height: 40,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
        },
        headerTitle: {
          position: "absolute",
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 20,
          fontWeight: "800",
          color: colors.text,
          letterSpacing: -0.2,
          pointerEvents: "none",
        },
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

  return (
    <View style={stylesThemed.root} {...androidSwipeBackPanHandlers}>
      <View style={[stylesThemed.list, { paddingTop: Math.max(insets.top, 12), paddingBottom: 0 }]}>
        <View style={stylesThemed.header}>
          <View style={stylesThemed.headerLeft}>
            <Pressable style={stylesThemed.headerBackBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
          </View>
          <Text numberOfLines={1} style={stylesThemed.headerTitle}>
            {categoryName}
          </Text>
          <View style={stylesThemed.headerRight}>
            <ThemeToggle />
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={stylesThemed.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[stylesThemed.list, { paddingTop: 0 }]}
          renderItem={({ item }) => (
            <Pressable style={stylesThemed.row} onPress={() => navigation.navigate("PlaceDetail", { id: item.id })}>
              <SmartImage
                uri={getLatestBusinessCardImage(item.images)}
                recyclingKey={item.id}
                style={styles.img}
                contentFit="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={stylesThemed.name}>{item.name}</Text>
                <Text style={stylesThemed.meta}>{Number(item.booking_price).toLocaleString()} $</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  img: { width: 80, height: 80, borderRadius: 8 },
});
