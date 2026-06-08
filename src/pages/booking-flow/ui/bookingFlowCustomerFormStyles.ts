import { Platform, StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";

export const bookingFlowCustomerFormStaticStyles = StyleSheet.create({
  section: { marginTop: 20, gap: 10 },
  label: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  commentInput: { minHeight: 72, textAlignVertical: "top" },
});

export function bookingFlowCustomerFormThemeStyles(colors: ThemeColors) {
  return {
    label: { color: colors.text },
    input: {
      borderColor: colors.border,
      backgroundColor: colors.card,
      color: colors.text,
    },
  };
}
