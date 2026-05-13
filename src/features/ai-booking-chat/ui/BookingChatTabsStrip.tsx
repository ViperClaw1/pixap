import { Pressable, ScrollView, Text, View } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { Ionicons } from "@expo/vector-icons";
import type { BookingChatTab } from "../model/types";

type Props = {
  tabs: BookingChatTab[];
  activeTabId: string | null;
  colors: ThemeColors;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onCloseTab: (id: string) => void;
};

export function BookingChatTabsStrip({ tabs, activeTabId, colors, onSelect, onAdd, onCloseTab }: Props) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
        {tabs.map((t) => {
          const active = t.id === activeTabId;
          return (
            <View
              key={t.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.border : colors.card,
                overflow: "hidden",
              }}
            >
              <Pressable onPress={() => onSelect(t.id)} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "600", maxWidth: 100 }}>
                  {t.title}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Close tab"
                onPress={() => onCloseTab(t.id)}
                style={{ paddingHorizontal: 6, paddingVertical: 6 }}
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <Pressable
        accessibilityLabel="New chat tab"
        onPress={onAdd}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
        }}
      >
        <Ionicons name="add" size={22} color={colors.primary} />
      </Pressable>
    </View>
  );
}
