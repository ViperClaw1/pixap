import { Pressable, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { AnalyticsPeriod } from "@/entities/admin-analytics";
import { ANALYTICS_PERIODS } from "../model/constants";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

type PeriodSelectorProps = {
  value: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
};

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const { t } = useTranslation();
  const styles = useThemeStyles(createStyles);

  return (
    <View style={styles.row}>
      {ANALYTICS_PERIODS.map((p) => {
        const active = p === value;
        return (
          <Pressable
            key={p}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(p)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {t(`adminDashboard.period.${p}d`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles({
  colors,
}: {
  colors: { surface: string; border: string; text: string; textMuted: string; primary: string; onPrimary: string };
}) {
  return StyleSheet.create({
    row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
    chipTextActive: { color: colors.onPrimary },
  });
}
