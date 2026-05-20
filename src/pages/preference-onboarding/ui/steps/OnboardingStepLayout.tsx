import type { ReactNode } from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function OnboardingStepLayout({ title, subtitle, children }: Props) {
  const { colors } = useAppTheme();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 120, flexGrow: 1 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  body: { flex: 1 },
});
