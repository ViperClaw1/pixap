import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

export const phoneInputStaticStyles = StyleSheet.create({
  container: {
    width: "100%",
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  containerError: {},
  countryButton: {
    width: 92,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderRightWidth: 1,
  },
  flag: { fontSize: 20, lineHeight: 22 },
  countryCodeText: { fontSize: 12, fontWeight: "700" },
  callingCodeText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 10,
  },
  input: {
    flex: 1,
    height: 56,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: "transparent",
  },
  pickerRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  pickerSearchWrap: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  pickerSearchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  pickerRowText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  pickerEmptyText: {
    paddingHorizontal: 14,
    paddingVertical: 20,
    fontSize: 14,
    textAlign: "center",
  },
});

export function phoneInputThemeStyles(colors: ThemeColors) {
  return {
    container: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    containerError: { borderColor: colors.danger },
    countryButton: { borderRightColor: colors.border },
    countryCodeText: { color: colors.text },
    callingCodeText: { color: colors.text },
    input: { color: colors.text },
    pickerSearchInput: {
      borderColor: colors.border,
      backgroundColor: colors.background,
      color: colors.text,
    },
    pickerRow: { borderBottomColor: colors.border },
    pickerRowText: { color: colors.text },
    pickerEmptyText: { color: colors.textMuted },
  } satisfies Partial<Record<keyof typeof phoneInputStaticStyles, object>>;
}

export function usePhoneInputStyles() {
  const themed = useThemeStyles(({ colors }) => phoneInputThemeStyles(colors));
  return useMemo(() => mergeStaticAndThemed(phoneInputStaticStyles, themed), [themed]);
}
