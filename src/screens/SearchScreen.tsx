import { useState, useMemo } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCards } from "@/hooks/useBusinessCards";
import type { SearchStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";

type Nav = NativeStackNavigationProp<SearchStackParamList, "SearchMain">;

export default function SearchScreen() {
  const navigation = useNavigation<Nav>();
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
    <View style={[stylesThemed.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <TextInput
        style={stylesThemed.input}
        placeholder="Search…"
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
            <SmartImage uri={item.image} recyclingKey={item.id} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={stylesThemed.name}>{item.name}</Text>
              <Text style={stylesThemed.meta} numberOfLines={1}>
                {item.address}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 56, height: 56, borderRadius: 8 },
});
