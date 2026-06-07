import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import {
  SEARCH_QUICK_FILTERS,
  type SearchQuickFilterId,
} from "../model/searchQuickFilters";

/** Fixed strip height — prevents horizontal ScrollView from stretching in flex layout. */
export const SEARCH_QUICK_FILTER_STRIP_HEIGHT = 40;

type Props = {
  activeFilters: ReadonlySet<SearchQuickFilterId>;
  onToggle: (id: SearchQuickFilterId) => void;
};

export function SearchQuickFilterPills({ activeFilters, onToggle }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <View style={styles.stripWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {SEARCH_QUICK_FILTERS.map((filter) => {
          const active = activeFilters.has(filter.id);
          return (
            <AppPressable
              key={filter.id}
              onPress={() => onToggle(filter.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.pill,
                {
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? `${colors.primary}26` : colors.card,
                },
              ]}
            >
              <Text style={styles.emoji}>{filter.emoji}</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: active ? colors.primary : colors.text,
                }}
              >
                {t(filter.labelKey, { defaultValue: filter.defaultLabel })}
              </Text>
            </AppPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stripWrap: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 12,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: SEARCH_QUICK_FILTER_STRIP_HEIGHT,
  },
  scrollContent: {
    alignItems: "center",
    gap: 8,
    paddingRight: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    height: SEARCH_QUICK_FILTER_STRIP_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  emoji: { fontSize: 14, lineHeight: 18 },
});
