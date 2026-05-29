import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { View, Text, StyleSheet } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import type { AnalyticsPeriod, TimeSeriesPoint } from "@/entities/admin-analytics";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { buildLineChartData } from "./chartAxisLabels";
import { CHART_CARD_H_PAD, CHART_HEIGHT } from "./chartLayout";

type AnalyticsLineChartProps = {
  title: string;
  points: TimeSeriesPoint[];
  period?: AnalyticsPeriod;
  area?: boolean;
};

export function AnalyticsLineChart({ title, points, period, area = false }: AnalyticsLineChartProps) {
  const { width } = useStaticWindowSize();
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const chartWidth = Math.max(200, width - CHART_CARD_H_PAD * 2 - 32);

  if (points.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>—</Text>
      </View>
    );
  }

  const data = buildLineChartData(points, period);
  const maxVal = Math.max(...points.map((p) => p.value), 1);
  const denseAxis = (period ?? 0) >= 30 || points.length > 14;
  const labelFontSize = denseAxis ? 8 : 9;
  const labelWidth = denseAxis ? 22 : 32;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <LineChart
        data={data}
        width={chartWidth}
        height={CHART_HEIGHT}
        areaChart={area}
        curved
        color={colors.accent}
        startFillColor={colors.accent}
        endFillColor={colors.accentSurface}
        startOpacity={0.35}
        endOpacity={0.05}
        thickness={2}
        hideDataPoints={points.length > 14}
        spacing={chartWidth / Math.max(data.length - 1, 1)}
        initialSpacing={8}
        endSpacing={8}
        maxValue={maxVal * 1.15}
        noOfSections={4}
        yAxisColor={colors.border}
        xAxisColor={colors.border}
        yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: labelFontSize, width: labelWidth }}
        xAxisLabelsHeight={denseAxis ? 18 : 22}
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
