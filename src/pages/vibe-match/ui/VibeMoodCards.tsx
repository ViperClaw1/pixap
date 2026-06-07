import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { TaxonomyOption } from "@/entities/user-preferences";

type Props = {
  options: TaxonomyOption[];
  selected: string[];
  onToggle: (id: string) => void;
};

export function VibeMoodCards({ options, selected, onToggle }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const active = selected.includes(option.id);
        return (
          <AppPressable
            key={option.id}
            onPress={() => onToggle(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              {
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.border : colors.background,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: colors.text }]}>
              {t(option.id, { keyPrefix: option.labelPrefix })}
            </Text>
          </AppPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
