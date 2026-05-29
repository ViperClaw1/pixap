import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { View, Text, StyleSheet } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useTranslation } from "react-i18next";
import type { WaOutcomeCounts, WaOutcomeKey } from "@/entities/admin-analytics";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { CHART_CARD_H_PAD, CHART_HEIGHT } from "./chartLayout";

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

type AnalyticsBarChartProps = {
  title: string;
  outcomes: WaOutcomeCounts;
};

export function AnalyticsBarChart({ title, outcomes }: AnalyticsBarChartProps) {
  const { t } = useTranslation();
  const { width } = useStaticWindowSize();
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const chartWidth = Math.max(200, width - CHART_CARD_H_PAD * 2 - 32);

  const barData = OUTCOME_KEYS.map((key) => ({
    value: outcomes[key],
    label: t(`adminDashboard.whatsapp.outcomeShort.${key}`),
    frontColor: OUTCOME_COLORS[key],
  }));

  const maxVal = Math.max(...barData.map((b) => b.value), 1);
  const total = barData.reduce((s, b) => s + b.value, 0);

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
      <BarChart
        data={barData}
        width={chartWidth}
        height={CHART_HEIGHT}
        barWidth={28}
        spacing={24}
        roundedTop
        maxValue={maxVal * 1.2}
        noOfSections={4}
        yAxisColor={colors.border}
        xAxisColor={colors.border}
        yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 9 }}
        rulesColor={colors.border}
        backgroundColor={colors.card}
      />
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
      padding: CHART_CARD_H_PAD,
      overflow: "hidden",
    },
    title: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 12 },
    empty: { fontSize: 14, color: colors.textMuted, paddingVertical: 40, textAlign: "center" },
  };
}
