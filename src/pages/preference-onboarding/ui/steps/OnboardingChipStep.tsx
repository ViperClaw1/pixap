import { ScrollView, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { PageI18nProvider } from "@/shared/lib/i18n";
import { OnboardingChipGrid } from "@/shared/ui/onboarding/OnboardingChipGrid";
import type { TaxonomyOption } from "@/entities/user-preferences";

type Props = {
  stepKeyPrefix: string;
  options: TaxonomyOption[];
  selected: string[];
  onToggle: (id: string) => void;
};

function OnboardingChipStepContent({ stepKeyPrefix, options, selected, onToggle }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: colors.text }]}>{t("title", { keyPrefix: stepKeyPrefix })}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t("subtitle", { keyPrefix: stepKeyPrefix })}</Text>
      <OnboardingChipGrid options={options} selected={selected} onToggle={onToggle} />
    </ScrollView>
  );
}

export function OnboardingChipStep(props: Props) {
  return (
    <PageI18nProvider>
      <OnboardingChipStepContent {...props} />
    </PageI18nProvider>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 24, gap: 12 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
});
