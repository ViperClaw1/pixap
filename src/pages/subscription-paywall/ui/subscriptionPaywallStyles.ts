import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

export const subscriptionPaywallStaticStyles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, lineHeight: 20 },
  plan: { fontWeight: "700", fontSize: 16 },
  feature: { fontSize: 14 },
  cta: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontWeight: "700" },
  secondary: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontWeight: "700" },
  legal: { fontSize: 12, textAlign: "center", marginTop: 6 },
});

export function subscriptionPaywallThemeStyles(
  colors: ThemeColors,
  topInset: number,
  bottomInset: number,
) {
  return {
    root: { backgroundColor: colors.background },
    content: {
      paddingTop: Math.max(12, topInset),
      paddingBottom: Math.max(24, bottomInset),
    },
    card: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    title: { color: colors.text },
    subtitle: { color: colors.textMuted },
    plan: { color: colors.text },
    feature: { color: colors.text },
    cta: { backgroundColor: colors.primary },
    ctaText: { color: colors.onPrimary },
    secondary: {
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    secondaryText: { color: colors.text },
    legal: { color: colors.textMuted },
  } satisfies Partial<Record<keyof typeof subscriptionPaywallStaticStyles, object>>;
}

export function useSubscriptionPaywallStyles(topInset: number, bottomInset: number) {
  const themed = useThemeStyles(
    ({ colors }) => subscriptionPaywallThemeStyles(colors, topInset, bottomInset),
    [topInset, bottomInset],
  );
  return useMemo(
    () => mergeStaticAndThemed(subscriptionPaywallStaticStyles, themed),
    [themed],
  );
}
