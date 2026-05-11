import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from "react-native";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCards } from "@/entities/business-card";
import type { SearchStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import { getLatestBusinessCardImage } from "@/lib/businessCardImages";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";

type Nav = NativeStackNavigationProp<SearchStackParamList, "SearchMain">;

export default function SearchScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { data: places = [] } = useBusinessCards();
  const [q, setQ] = useState("");

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

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          fontSize: 16,
          color: colors.text,
          backgroundColor: colors.card,
        },
        row: {
          flexDirection: "row",
          gap: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        name: { fontWeight: "700", color: colors.text },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
      }),
    [colors],
  );

  return (
    <View style={[stylesThemed.root, { paddingTop: Math.max(insets.top, 12) }]} {...androidSwipeBackPanHandlers}>
      <TextInput
        style={stylesThemed.input}
        placeholder={t("search.placeholder")}
        value={q}
        onChangeText={setQ}
        placeholderTextColor={colors.textMuted}
      />
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        renderItem={({ item }) => (
          <Pressable style={stylesThemed.row} onPress={() => navigation.navigate("PlaceDetail", { id: item.id })}>
            <SmartImage
              uri={getOptimizedImageUrl(getLatestBusinessCardImage(item.images), 168, 168, 72)}
              fallbackUri={getLatestBusinessCardImage(item.images)}
              recyclingKey={item.id}
              style={styles.thumb}
              contentFit="cover"
              skipBundledPlaceholder
            />
            <View style={{ flex: 1 }}>
              <Text style={stylesThemed.name}>{item.name}</Text>
              <Text style={stylesThemed.meta} numberOfLines={1}>
                {item.address}
              </Text>
            </View>
          </Pressable>
        )}
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
