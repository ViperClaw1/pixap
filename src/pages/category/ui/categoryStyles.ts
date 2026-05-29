import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";

export const categoryStaticStyles = StyleSheet.create({
  img: { width: 80, height: 80, borderRadius: 8, overflow: "hidden" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  root: { flex: 1 },
  list: {},
  header: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", zIndex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", zIndex: 1 },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.2,
    pointerEvents: "none",
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
  },
  body: { flex: 1, minWidth: 0 },
  name: { fontWeight: "700", fontSize: 16 },
  address: { marginTop: 4, fontSize: 12 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: "100%",
  },
  tagText: {
    fontSize: 10,
    fontWeight: "500",
  },
  showMoreBtn: {
    marginTop: 4,
    marginBottom: 8,
    alignSelf: "center",
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  showMoreBtnText: { fontSize: 14, fontWeight: "700" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
  },
});

export function categoryThemeStyles(colors: ThemeColors, _isDark: boolean, bottomInset: number) {
  return {
    centered: { backgroundColor: colors.background },
    root: { backgroundColor: colors.background },
    list: { padding: 16, paddingBottom: 40 + bottomInset },
    headerBackBtn: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    headerTitle: { color: colors.text },
    row: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    name: { color: colors.text },
    address: { color: colors.textMuted },
    tagPill: { backgroundColor: colors.tagMuted },
    tagText: { color: colors.tagMutedText },
    showMoreBtn: { backgroundColor: colors.accent },
    showMoreBtnText: { color: colors.onAccent },
    emptyText: { color: colors.textMuted },
  } satisfies Partial<Record<keyof typeof categoryStaticStyles, object>>;
}
