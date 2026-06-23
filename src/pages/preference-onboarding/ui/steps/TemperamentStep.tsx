import { Text, View, ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { PageI18nProvider } from "@/shared/lib/i18n";
import { TemperamentSliders } from "@/shared/ui/onboarding/TemperamentSliders";
import type { Temperament } from "@/entities/user-preferences";

type Props = {
  value: Temperament;
  onChange: (key: keyof Temperament, v: number) => void;
};

function TemperamentStepContent({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: colors.text }]}>{t("title", { keyPrefix: "onboarding.steps.temperament" })}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {t("subtitle", { keyPrefix: "onboarding.steps.temperament" })}
      </Text>
      <TemperamentSliders value={value} onChange={onChange} />
    </ScrollView>
  );
}

export function TemperamentStep(props: Props) {
  return (
    <PageI18nProvider>
      <TemperamentStepContent {...props} />
    </PageI18nProvider>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
});
