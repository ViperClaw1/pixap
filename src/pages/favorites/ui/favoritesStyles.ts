import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";

export const favoritesStaticStyles = StyleSheet.create({
  thumb: { width: 56, height: 56, borderRadius: 8 },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  name: { fontWeight: "700" },
  meta: { fontSize: 12, marginTop: 4 },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyListWrap: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  empty: { textAlign: "center", fontSize: 14, lineHeight: 20 },
});

export function favoritesThemeStyles(colors: ThemeColors) {
  return {
    row: { borderBottomColor: colors.border },
    name: { color: colors.text },
    meta: { color: colors.textMuted },
    empty: { color: colors.textMuted },
  } satisfies Partial<Record<keyof typeof favoritesStaticStyles, object>>;
}
