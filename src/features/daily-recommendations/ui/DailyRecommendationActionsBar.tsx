import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
          size={18}
          color={isFavorite ? colors.danger : colors.text}
        />
        <Text style={[styles.actionLabel, { color: isFavorite ? colors.danger : colors.text }]} numberOfLines={1}>
          {saveLabel}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.accentSurface }]}
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel={shareLabel}
      >
        <Ionicons name="share-social-outline" size={18} color={colors.primary} />
        <Text style={[styles.actionLabel, { color: colors.primary }]} numberOfLines={1}>
          {shareLabel}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={onDislike}
        accessibilityRole="button"
        accessibilityLabel={dislikeLabel}
      >
        <Ionicons name="thumbs-down-outline" size={18} color={colors.textMuted} />
        <Text style={[styles.actionLabel, { color: colors.textMuted }]} numberOfLines={1}>
          {dislikeLabel}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.bookBtn, { backgroundColor: colors.primary }]}
        onPress={onBook}
        accessibilityRole="button"
        accessibilityLabel={bookLabel}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.onPrimary ?? "#fff"} />
        <Text style={[styles.bookLabel, { color: colors.onPrimary ?? "#fff" }]} numberOfLines={1}>
          {bookLabel}
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
  actionBtn: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  bookBtn: {
    flex: 1.15,
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  bookLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
});
