import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { useTranslation } from "react-i18next";
import type { WaOutcomeCounts, WaOutcomeKey } from "@/entities/admin-analytics";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

const OUTCOME_KEYS: WaOutcomeKey[] = [
  "success",
  "missing_whatsapp",
  "venue_rejection",
  "other",
];

const OUTCOME_COLORS: Record<WaOutcomeKey, string> = {
  success: "#22c55e",
  missing_whatsapp: "#f59e0b",
  venue_rejection: "#ef4444",
  other: "#94a3b8",
};

type AnalyticsPieChartProps = {
  title: string;
  outcomes: WaOutcomeCounts;
};

export function AnalyticsPieChart({ title, outcomes }: AnalyticsPieChartProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const radius = Math.min(90, (width - 80) / 4);

  const pieData = OUTCOME_KEYS.map((key) => ({
    value: outcomes[key],
    color: OUTCOME_COLORS[key],
    text: outcomes[key] > 0 ? String(outcomes[key]) : "",
  })).filter((d) => d.value > 0);

  const total = OUTCOME_KEYS.reduce((s, k) => s + outcomes[k], 0);

  if (total === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>—</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.row}>
        <PieChart
          data={pieData}
          radius={radius}
          donut
          innerRadius={radius * 0.55}
          innerCircleColor={colors.card}
          centerLabelComponent={() => (
            <Text style={[styles.center, { color: colors.text }]}>{total}</Text>
          )}
        />
        <View style={styles.legend}>
          {OUTCOME_KEYS.map((key) => (
            <View key={key} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: OUTCOME_COLORS[key] }]} />
              <Text style={styles.legendText} numberOfLines={1}>
                {t(`adminDashboard.whatsapp.outcome.${key}`)} ({outcomes[key]})
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function createStyles({ colors }: { colors: { card: string; border: string; text: string; textMuted: string } }) {
  return {
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 16,
    },
    title: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 12 },
    row: { flexDirection: "row", alignItems: "center", gap: 16 },
    center: { fontSize: 18, fontWeight: "800" },
    legend: { flex: 1, gap: 8 },
    legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 11, color: colors.textMuted, flex: 1 },
    empty: { fontSize: 14, color: colors.textMuted, paddingVertical: 24, textAlign: "center" },
  };
}
