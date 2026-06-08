import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";

export const bookingPersonalDataNoticeStaticStyles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  body: { flex: 1, gap: 10 },
  message: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  cta: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ctaText: { fontSize: 13, fontWeight: "700" },
});

export function bookingPersonalDataNoticeThemeStyles(
  colors: ThemeColors,
  variant: "info" | "required" | "tip",
) {
  const accent =
    variant === "required" || variant === "tip" ? colors.warningBorder : colors.primary;
  return {
    root: {
      borderColor: accent,
      backgroundColor:
        variant === "required" ? colors.accentSurface : variant === "tip" ? colors.card : colors.card,
    },
    message: { color: colors.text },
    cta: { backgroundColor: variant === "tip" ? colors.primary : accent },
    ctaText: { color: colors.onPrimary },
  };
}
