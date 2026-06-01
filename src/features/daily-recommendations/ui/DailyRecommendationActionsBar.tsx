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
          <Ionicons name="calendar-outline" size={18} color="#ffffff" style={styles.ctaIcon} />
          <Text
            style={styles.bookTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {bookTitle}
          </Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        style={[styles.howToGetBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={onHowToGet}
        accessibilityRole="button"
        accessibilityLabel={howToGetTitle}
      >
        <Ionicons name="navigate-outline" size={18} color={colors.text} style={styles.ctaIcon} />
        <Text
          style={[styles.howToGetTitle, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
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
    gap: 6,
  },
  ctaPressable: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: 14,
    overflow: "hidden",
  },
  bookGradient: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 8,
  },
  ctaIcon: {
    flexShrink: 0,
  },
  bookTitle: {
    flexShrink: 1,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  howToGetBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 14,
  },
  howToGetTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
});
