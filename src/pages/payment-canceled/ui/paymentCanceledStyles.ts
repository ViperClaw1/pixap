import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

export const paymentCanceledStaticStyles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  body: { marginBottom: 24 },
  btn: {
    ...primaryPressableStyle,
  },
  btnText: primaryPressableTextStyle,
});

export function paymentCanceledThemeStyles(colors: ThemeColors, bottomInset: number) {
  return {
    root: {
      backgroundColor: colors.background,
      paddingBottom: Math.max(bottomInset, 24),
    },
    title: { color: colors.text },
    body: { color: colors.textMuted },
  } satisfies Partial<Record<keyof typeof paymentCanceledStaticStyles, object>>;
}
