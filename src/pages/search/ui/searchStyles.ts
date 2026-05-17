import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";

export const searchStaticStyles = StyleSheet.create({
  thumb: { width: 56, height: 56, borderRadius: 8 },
  root: { flex: 1, paddingHorizontal: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
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
});

export function searchThemeStyles(colors: ThemeColors, _isDark: boolean) {
  return {
    root: { backgroundColor: colors.background },
    input: {
      borderColor: colors.border,
      color: colors.text,
      backgroundColor: colors.card,
    },
    row: { borderBottomColor: colors.border },
    name: { color: colors.text },
    meta: { color: colors.textMuted },
    tagPill: { backgroundColor: colors.tagMuted },
    tagText: { color: colors.tagMutedText },
    showMoreBtn: { backgroundColor: colors.accent },
    showMoreBtnText: { color: colors.onAccent },
  } satisfies Partial<Record<keyof typeof searchStaticStyles, object>>;
}
