import { View, Text, StyleSheet } from "react-native";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { TrendBadge } from "./TrendBadge";

type MetricCardProps = {
  label: string;
  value: string;
  subtitle?: string;
  trendPct?: number;
};

export function MetricCard({ label, value, subtitle, trendPct }: MetricCardProps) {
  const styles = useThemeStyles(createStyles);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={styles.value}>{value}</Text>
        {trendPct != null ? <TrendBadge pct={trendPct} /> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function createStyles({ colors }: { colors: { card: string; border: string; text: string; textMuted: string } }) {
  return {
    card: {
      flex: 1,
      minWidth: 140,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 14,
    },
    label: { fontSize: 12, color: colors.textMuted, marginBottom: 6, fontWeight: "600" },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    value: { fontSize: 22, fontWeight: "800", color: colors.text, flexShrink: 1 },
    subtitle: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  };
}
