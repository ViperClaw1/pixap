import type { ThemeColors } from "@/shared/theme/palettes";

/** Brighter accent-tinted surface for booking credits balance badge. */
export function resolveBookingCreditsBadgeSurface(colors: ThemeColors, isDark: boolean) {
  return {
    backgroundColor: isDark ? `${colors.accent}55` : `${colors.accent}38`,
    borderColor: isDark ? `${colors.accent}90` : `${colors.accent}72`,
    textColor: colors.text,
  };
}

/** Urgent (danger) surface for last-credit urgency state. */
export function resolveBookingCreditsBadgeUrgentSurface(colors: ThemeColors) {
  return {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.danger,
    textColor: colors.danger,
  };
}
