import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { radii } from "@/shared/theme/radii";

export const SEARCH_PLACE_THUMB_SIZE = 104;

export const searchStaticStyles = StyleSheet.create({
  thumbWrap: { position: "relative" },
  thumb: {
    width: SEARCH_PLACE_THUMB_SIZE,
    height: SEARCH_PLACE_THUMB_SIZE,
    borderRadius: radii.thumb,
    overflow: "hidden",
  },
  thumbStatus: {
    position: "absolute",
    left: 6,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  thumbStatusDot: { width: 6, height: 6, borderRadius: 3 },
  thumbStatusText: { fontSize: 10, fontWeight: "700", color: "#ffffff" },
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, minHeight: 0 },
  cityRow: {
    marginBottom: 8,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  list: { flex: 1 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    paddingLeft: 12,
    paddingRight: 4,
    minHeight: 48,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingRight: 4,
    fontSize: 16,
  },
  clearBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  body: { flex: 1, minWidth: 0 },
  name: { fontWeight: "700" },
  meta: { fontSize: 12, marginTop: 4 },
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
    marginTop: 8,
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
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
  },
});

export function searchThemeStyles(colors: ThemeColors, _isDark: boolean) {
  return {
    root: { backgroundColor: colors.background },
    inputWrap: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    input: {
      color: colors.text,
    },
    row: { borderBottomColor: colors.border },
    name: { color: colors.text },
    meta: { color: colors.textMuted },
    tagPill: { backgroundColor: colors.tagMuted },
    tagText: { color: colors.tagMutedText },
    showMoreBtn: { backgroundColor: colors.accent },
    showMoreBtnText: { color: colors.onAccent },
    emptyText: { color: colors.textMuted },
  } satisfies Partial<Record<keyof typeof searchStaticStyles, object>>;
}
