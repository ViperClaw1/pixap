import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

type DashboardSectionProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function DashboardSection({ title, subtitle, children }: DashboardSectionProps) {
  const styles = useThemeStyles(createStyles);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function createStyles({ colors }: { colors: { text: string; textMuted: string } }) {
  return StyleSheet.create({
    section: { gap: 12, marginBottom: 24 },
    title: { fontSize: 18, fontWeight: "800", color: colors.text },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: -6, marginBottom: 4 },
  });
}
