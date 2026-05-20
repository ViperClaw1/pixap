import { Pressable, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { TaxonomyOption } from "@/entities/user-preferences";

type Props = {
  options: TaxonomyOption[];
  selected: string[];
  onToggle: (id: string) => void;
};

export function OnboardingChipGrid({ options, selected, onToggle }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <View style={styles.grid}>
      {options.map((opt) => {
        const active = selected.includes(opt.id);
        return (
          <Pressable
            key={opt.id}
            onPress={() => onToggle(opt.id)}
            style={[
              styles.chip,
              {
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? `${colors.primary}22` : colors.card,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? colors.primary : colors.text }]}>
              {t(opt.id, { keyPrefix: opt.labelPrefix })}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
