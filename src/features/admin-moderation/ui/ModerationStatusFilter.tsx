import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { AdminReportStatusFilter } from "@/entities/admin-moderation";

const FILTERS: AdminReportStatusFilter[] = ["pending", "all", "reviewed", "dismissed", "action_taken"];

type Props = {
  value: AdminReportStatusFilter;
  onChange: (value: AdminReportStatusFilter) => void;
  pendingCount?: number;
};

export function ModerationStatusFilter({ value, onChange, pendingCount }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {FILTERS.map((filter) => {
        const active = value === filter;
        const label =
          filter === "pending"
            ? pendingCount != null && pendingCount > 0
              ? t("adminModeration.filters.pending", { count: pendingCount })
              : t("adminModeration.filters.pendingEmpty")
            : t(`adminModeration.filters.${filter}`);
        return (
          <Pressable
            key={filter}
            style={[
              styles.chip,
              {
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.accentSurface : colors.card,
              },
            ]}
            onPress={() => onChange(filter)}
          >
            <Text style={[styles.chipText, { color: active ? colors.primary : colors.text }]}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
