import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { DailyRecommendation } from "@/entities/daily-recommendation";

type Props = {
  recommendation: DailyRecommendation | null;
  onOpen: () => void;
};

export function DailyPicksHero({ recommendation, onOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <Pressable
      style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={t("dailyRecommendations.openHero", { defaultValue: "Open daily recommendations" })}
    >
      <View style={styles.header}>
        <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>
          {t("dailyRecommendations.heroTitle", { defaultValue: "Tonight for You" })}
        </Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {recommendation?.name ??
          t("dailyRecommendations.heroSubtitle", { defaultValue: "Fresh personalized picks generated daily." })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    gap: 6,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "700" },
  subtitle: { fontSize: 13, lineHeight: 18 },
});
