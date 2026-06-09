/** Shared gradient color stops (expo-linear-gradient). */
export const GRADIENT_CTA_LIGHT = ["#9333ea", "#db2777", "#f97316"] as const;
export const GRADIENT_CTA_DARK = ["#6d28d9", "#be185d", "#ea580c"] as const;

export const GRADIENT_BOOK_LIGHT = ["#ff6b4a", "#ec6544", "#db2777"] as const;
export const GRADIENT_BOOK_DARK = ["#ff7a59", "#ea580c", "#be185d"] as const;

/** Vibe timeline: dawn → night (horizontal). */
export const TIMELINE_GRADIENT = ["#FFD6A5", "#FF7E5F", "#6B2FBA", "#1a1a3e"] as const;

/** Hero photo overlay (bottom fade). */
export const HERO_OVERLAY_GRADIENT = ["transparent", "rgba(0,0,0,0.75)"] as const;

export function ctaGradientColors(isDark: boolean): readonly [string, string, ...string[]] {
  return isDark ? GRADIENT_CTA_DARK : GRADIENT_CTA_LIGHT;
}

export function bookGradientColors(isDark: boolean): readonly [string, string, ...string[]] {
  return isDark ? GRADIENT_BOOK_DARK : GRADIENT_BOOK_LIGHT;
}
