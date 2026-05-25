import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";

export const bookingsStaticStyles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  fpill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  fpillActive: {},
  fpillText: { fontSize: 11, textTransform: "capitalize", fontWeight: "600" },
  fpillTextA: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    flexShrink: 0,
  },
  thumbCompact: {
    width: 56,
    height: 56,
  },
  name: { fontWeight: "700", flexShrink: 1, fontSize: 15 },
  meta: { fontSize: 12, marginTop: 4 },
  priceFromVenue: { fontSize: 14, marginTop: 6, fontWeight: "700" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  waitingBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  waitingBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyListWrap: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  empty: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  rowHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  rowHeadLeft: { flex: 1, minWidth: 0, paddingRight: 4 },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    flexShrink: 0,
    minWidth: 64,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 11, fontWeight: "700" },
  payBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  payBtnText: { fontSize: 12, fontWeight: "700" },
  skeletonList: { padding: 16, gap: 0 },
  skeletonCard: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  skeletonBody: { flex: 1, minWidth: 0 },
  skeletonRowHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  skeletonMetaGap: { marginTop: 8 },
  skeletonBadgeGap: { marginTop: 10 },
});

export function bookingsThemeStyles(colors: ThemeColors) {
  return {
    root: { backgroundColor: colors.background },
    fpill: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    fpillActive: { backgroundColor: colors.text, borderColor: colors.text },
    fpillText: { color: colors.text },
    fpillTextA: { color: colors.background },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    thumb: {
      backgroundColor: colors.surface,
    },
    name: { color: colors.text },
    meta: { color: colors.textMuted },
    priceFromVenue: { color: colors.text },
    waitingBadge: { backgroundColor: colors.border },
    waitingBadgeText: { color: colors.textMuted },
    empty: { color: colors.textMuted },
    cancelBtn: { borderColor: colors.danger },
    cancelBtnText: { color: colors.danger },
    payBtn: { backgroundColor: colors.primary },
    payBtnText: { color: colors.onPrimary },
    skeletonCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
  } satisfies Partial<Record<keyof typeof bookingsStaticStyles, object>>;
}
