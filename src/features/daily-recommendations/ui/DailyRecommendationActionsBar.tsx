import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ThemeColors } from "@/shared/theme/palettes";

const BOOK_GRADIENT_LIGHT = ["#ff6b4a", "#ec6544", "#db2777"] as const;
const BOOK_GRADIENT_DARK = ["#ff7a59", "#ea580c", "#be185d"] as const;

type Props = {
  colors: ThemeColors;
  isDark: boolean;
  bookTitle: string;
  howToGetTitle: string;
  onBook: () => void;
  onHowToGet: () => void;
  bottomInset: number;
};

function DailyRecommendationActionsBarInner({
  colors,
  isDark,
  bookTitle,
  howToGetTitle,
  onBook,
  onHowToGet,
  bottomInset,
}: Props) {
  return (
    <View style={[styles.root, { paddingBottom: bottomInset + 12 }]}>
      <Pressable
        style={styles.ctaPressable}
        onPress={onBook}
        accessibilityRole="button"
        accessibilityLabel={bookTitle}
      >
        <LinearGradient
          colors={isDark ? [...BOOK_GRADIENT_DARK] : [...BOOK_GRADIENT_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bookGradient}
        >
          <Ionicons name="calendar-outline" size={20} color="#ffffff" />
          <Text style={styles.bookTitle}>{bookTitle}</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        style={[styles.howToGetBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={onHowToGet}
        accessibilityRole="button"
        accessibilityLabel={howToGetTitle}
      >
        <Ionicons name="navigate-outline" size={20} color={colors.text} />
        <Text style={[styles.howToGetTitle, { color: colors.text }]} numberOfLines={1}>
          {howToGetTitle}
        </Text>
      </Pressable>
    </View>
  );
}

export const DailyRecommendationActionsBar = memo(DailyRecommendationActionsBarInner);

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    gap: 8,
  },
  ctaPressable: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    overflow: "hidden",
  },
  bookGradient: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  bookTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  howToGetBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  howToGetTitle: {
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
});
