import { useMemo } from "react";
import { useTranslation } from "react-i18next";
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
        body: { flex: 1, minWidth: 0 },
        name: { fontWeight: "700", fontSize: 16, color: colors.text },
        address: { marginTop: 4, fontSize: 12, color: colors.textMuted },
        tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
        tagPill: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: isDark ? "#0d0d0f" : "#f4f4f5",
          maxWidth: "100%",
        },
        tagText: {
          fontSize: 10,
          fontWeight: "500",
          color: isDark ? "#e8e8ea" : "#27272a",
        },
      }),
    [colors, insets.bottom, isDark],
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
          renderItem={({ item }) => {
            const visibleTags = (item.tags ?? []).slice(0, PLACE_CARD_MAX_TAGS);
            return (
              <Pressable style={stylesThemed.row} onPress={() => navigation.navigate("PlaceDetail", { id: item.id })}>
                <SmartImage
                  uri={getLatestBusinessCardImage(item.images)}
                  recyclingKey={item.id}
                  style={styles.img}
                  contentFit="cover"
                />
                <View style={stylesThemed.body}>
                  <Text style={stylesThemed.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.address?.trim() ? (
                    <Text style={stylesThemed.address} numberOfLines={2}>
                      {item.address.trim()}
                    </Text>
                  ) : null}
                  {visibleTags.length > 0 ? (
                    <View style={stylesThemed.tagsRow}>
                      {visibleTags.map((tag) => (
                        <View key={tag} style={stylesThemed.tagPill}>
                          <Text style={stylesThemed.tagText} numberOfLines={1}>
                            {tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  img: { width: 80, height: 80, borderRadius: 8 },
});
