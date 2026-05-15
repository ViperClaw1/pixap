import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

export const shoppingItemsStaticStyles = StyleSheet.create({
  thumb: { width: 56, height: 56, borderRadius: 8 },
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  back: { fontSize: 22 },
  title: { fontSize: 18, fontWeight: "700" },
  sub: { fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  name: { fontWeight: "700" },
  price: { marginTop: 4 },
  plus: { fontSize: 22, fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "70%",
    borderTopWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  extraRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  extraLabel: { flex: 1 },
  qtyBtn: { fontSize: 20, paddingHorizontal: 8 },
  qtyVal: { minWidth: 24, textAlign: "center" },
  primary: {
    marginTop: 16,
    ...primaryPressableStyle,
  },
  primaryText: primaryPressableTextStyle,
  cancel: { textAlign: "center", marginTop: 12 },
});

export function shoppingItemsThemeStyles(colors: ThemeColors, bottomInset: number) {
  return {
    root: { backgroundColor: colors.background },
    centered: { backgroundColor: colors.background },
    back: { color: colors.text },
    title: { color: colors.text },
    sub: { color: colors.textMuted },
    row: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    name: { color: colors.text },
    price: { color: colors.textMuted },
    plus: { color: colors.text },
    modalCard: {
      backgroundColor: colors.card,
      paddingBottom: Math.max(bottomInset, 20),
      borderColor: colors.border,
    },
    modalTitle: { color: colors.text },
    extraLabel: { color: colors.text },
    qtyBtn: { color: colors.text },
    qtyVal: { color: colors.text },
    cancel: { color: colors.textMuted },
  } satisfies Partial<Record<keyof typeof shoppingItemsStaticStyles, object>>;
}
