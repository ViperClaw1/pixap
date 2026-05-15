import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

export const cartStaticStyles = StyleSheet.create({
  root: { flex: 1 },
  header: { fontSize: 22, fontWeight: "800", paddingHorizontal: 16, marginBottom: 8 },
  tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabActive: {},
  tabText: { fontWeight: "600" },
  tabTextActive: { fontWeight: "700" },
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  name: { fontWeight: "700" },
  meta: { fontSize: 12, marginTop: 4 },
  price: { marginTop: 6, fontWeight: "700" },
  child: { fontSize: 12 },
  shopTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  shopTitleCol: { flex: 1, minWidth: 0 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  qtyBtn: { fontSize: 20, fontWeight: "700" },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },
  smallBtnDanger: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  smallBtnText: { fontSize: 12, fontWeight: "600" },
  smallBtnOutline: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "transparent",
    alignItems: "center",
  },
  smallBtnOutlineText: { fontSize: 12, fontWeight: "600" },
  waStatusLine: { fontSize: 12, lineHeight: 18 },
  dangerBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  empty: { textAlign: "center", marginTop: 32 },
  payBar: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  totalLabel: { fontSize: 14 },
  totalVal: { fontSize: 20, fontWeight: "800", marginTop: 4 },
  payBtn: {
    marginTop: 12,
    ...primaryPressableStyle,
  },
  payBtnText: primaryPressableTextStyle,
  deleteIconBtn: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.45)",
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  vendorBadge: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  vendorBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
});

export function cartThemeStyles(colors: ThemeColors, bottomInset: number) {
  return {
    root: { backgroundColor: colors.background },
    header: { color: colors.text },
    tab: { backgroundColor: colors.border },
    tabActive: { backgroundColor: colors.primary },
    tabText: { color: colors.text },
    tabTextActive: { color: colors.onPrimary },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    name: { color: colors.text },
    meta: { color: colors.textMuted },
    price: { color: colors.text },
    child: { color: colors.textMuted },
    qtyBtn: { color: colors.text },
    smallBtn: { backgroundColor: colors.primary },
    smallBtnText: { color: colors.onPrimary },
    smallBtnDanger: { backgroundColor: colors.danger },
    smallBtnOutline: { borderColor: colors.border },
    smallBtnOutlineText: { color: colors.text },
    waStatusLine: { color: colors.textMuted },
    empty: { color: colors.textMuted },
    payBar: {
      paddingBottom: 16 + bottomInset,
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    totalLabel: { color: colors.textMuted },
    totalVal: { color: colors.text },
    vendorBadge: {
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    vendorBadgeText: { color: colors.textMuted },
  } satisfies Partial<Record<keyof typeof cartStaticStyles, object>>;
}

export type CartScreenStyles = typeof cartStaticStyles;

export function useCartStyles(bottomInset: number) {
  const themed = useThemeStyles(({ colors }) => cartThemeStyles(colors, bottomInset), [bottomInset]);
  return useMemo(() => mergeStaticAndThemed(cartStaticStyles, themed), [themed]);
}

/** @deprecated Use useCartStyles — kept for gradual migration */
export function createCartStyles(colors: ThemeColors, bottomInset: number) {
  return mergeStaticAndThemed(cartStaticStyles, cartThemeStyles(colors, bottomInset));
}
