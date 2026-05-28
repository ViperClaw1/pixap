import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

type TrendBadgeProps = {
  pct: number;
  label?: string;
};

export function TrendBadge({ pct, label }: TrendBadgeProps) {
  const styles = useThemeStyles(createStyles);
  const up = pct >= 0;
  const icon = up ? "trending-up" : "trending-down";
  const colorStyle = up ? styles.up : styles.down;

  return (
    <View style={[styles.root, colorStyle]}>
      <Ionicons name={icon} size={14} color={up ? styles.upText.color : styles.downText.color} />
      <Text style={[styles.text, up ? styles.upText : styles.downText]}>
        {up ? "+" : ""}
        {pct}%
      </Text>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

function createStyles({
  colors,
}: {
  colors: { successSurface: string; dangerSurface: string; danger: string; textMuted: string };
}) {
  return {
    root: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    up: { backgroundColor: colors.successSurface },
    down: { backgroundColor: colors.dangerSurface },
    text: { fontSize: 13, fontWeight: "700" },
    upText: { color: "#15803d" },
    downText: { color: colors.danger },
    label: { fontSize: 12, color: colors.textMuted, marginLeft: 4 },
  };
}
