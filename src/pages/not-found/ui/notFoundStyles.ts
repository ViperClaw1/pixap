import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

export const notFoundStaticStyles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 16 },
  btn: {
    ...primaryPressableStyle,
    paddingHorizontal: 24,
  },
  btnText: primaryPressableTextStyle,
});

export function notFoundThemeStyles(colors: ThemeColors, topInset: number, bottomInset: number) {
  return {
    root: {
      paddingTop: Math.max(topInset, 24),
      paddingBottom: Math.max(bottomInset, 24),
      backgroundColor: colors.background,
    },
    title: { color: colors.text },
  } satisfies Partial<Record<keyof typeof notFoundStaticStyles, object>>;
}
