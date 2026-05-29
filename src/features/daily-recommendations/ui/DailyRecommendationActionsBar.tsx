import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeColors } from "@/shared/theme/palettes";

type Props = {
  colors: ThemeColors;
  isFavorite: boolean;
  saveLabel: string;
  shareLabel: string;
  dislikeLabel: string;
  bookLabel: string;
  onSave: () => void;
  onShare: () => void;
  onDislike: () => void;
  onBook: () => void;
  bottomInset: number;
};

function DailyRecommendationActionsBarInner({
  colors,
  isFavorite,
  saveLabel,
  shareLabel,
  dislikeLabel,
  bookLabel,
  onSave,
  onShare,
  onDislike,
  onBook,
  bottomInset,
}: Props) {
  return (
    <View style={[styles.root, { paddingBottom: bottomInset + 12 }]}>
      <Pressable
        style={[
          styles.actionBtn,
          {
            borderColor: isFavorite ? colors.danger : colors.border,
            backgroundColor: isFavorite ? colors.dangerSurface : colors.card,
          },
        ]}
        onPress={onSave}
        accessibilityRole="button"
        accessibilityLabel={saveLabel}
      >
        <Ionicons
          name={isFavorite ? "bookmark" : "bookmark-outline"}
          size={22}
          color={isFavorite ? colors.danger : colors.text}
        />
      </Pressable>

      <Pressable
        style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.accentSurface }]}
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel={shareLabel}
      >
        <Ionicons name="share-social-outline" size={22} color={colors.primary} />
      </Pressable>

      <Pressable
        style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={onDislike}
        accessibilityRole="button"
        accessibilityLabel={dislikeLabel}
      >
        <Ionicons name="thumbs-down-outline" size={22} color={colors.textMuted} />
      </Pressable>

      <Pressable
        style={[styles.bookBtn, { backgroundColor: colors.primary }]}
        onPress={onBook}
        accessibilityRole="button"
        accessibilityLabel={bookLabel}
      >
        <Ionicons name="calendar-outline" size={22} color={colors.onPrimary ?? "#fff"} />
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
  actionBtn: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bookBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
