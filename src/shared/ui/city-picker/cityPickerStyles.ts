import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";

export const cityPickerStaticStyles = StyleSheet.create({
  compactTrigger: {
    flexShrink: 1,
    maxWidth: "58%",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
  },
  compactTriggerWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  compactTriggerText: { fontSize: 12, fontWeight: "600" },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  dropdownTriggerText: { flex: 1, fontSize: 16, fontWeight: "600" },
  dropdownPlaceholder: { fontWeight: "500" },
  cityRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cityRowText: { fontSize: 14, flex: 1 },
  cityCheck: { fontWeight: "700", fontSize: 12 },
  citySearchBox: {
    marginHorizontal: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  citySearchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  countryHeader: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  countryHeaderText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  cityPickerEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 20,
    alignItems: "center",
  },
  cityPickerEmptyText: { fontSize: 14, textAlign: "center" },
});

export function cityPickerThemeStyles(colors: ThemeColors) {
  return {
    compactTrigger: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    compactTriggerText: { color: colors.text },
    dropdownTrigger: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    dropdownTriggerText: { color: colors.text },
    dropdownPlaceholder: { color: colors.textMuted },
    cityRow: { borderBottomColor: colors.border },
    cityRowText: { color: colors.text },
    cityCheck: { color: colors.primary },
    citySearchBox: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    citySearchInput: { color: colors.text },
    countryHeader: { borderBottomColor: colors.border },
    countryHeaderText: { color: colors.textMuted },
    cityPickerEmptyText: { color: colors.textMuted },
  };
}
