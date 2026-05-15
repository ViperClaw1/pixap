import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";

export const myPurchasesStaticStyles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", flex: 1 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  purchaseCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  typePill: {
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typePillText: { fontSize: 11, fontWeight: "700" },
  purchaseLabel: { fontSize: 11, fontWeight: "600", marginTop: 8 },
  purchaseValue: { fontSize: 14, marginTop: 2 },
  childLine: { fontSize: 12, marginTop: 4 },
  bookingBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  emptyText: { textAlign: "center", marginTop: 12, fontSize: 14 },
});

export function myPurchasesThemeStyles(colors: ThemeColors) {
  return {
    root: { backgroundColor: colors.background },
    header: { borderBottomColor: colors.border },
    headerTitle: { color: colors.text },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    purchaseCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    typePill: { backgroundColor: colors.card },
    typePillText: { color: colors.textMuted },
    purchaseLabel: { color: colors.textMuted },
    purchaseValue: { color: colors.text },
    childLine: { color: colors.textMuted },
    bookingBlock: { borderTopColor: colors.border },
    emptyText: { color: colors.textMuted },
  } satisfies Partial<Record<keyof typeof myPurchasesStaticStyles, object>>;
}
