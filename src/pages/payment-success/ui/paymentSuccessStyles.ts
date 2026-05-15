import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import {
  SHARED_PRESSABLE_HEIGHT,
  SHARED_PRESSABLE_RADIUS,
  primaryPressableStyle,
  primaryPressableTextStyle,
} from "@/shared/theme/primaryPressable";

export const paymentSuccessStaticStyles = StyleSheet.create({
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
  secondaryBtn: {
    marginTop: 12,
    minHeight: SHARED_PRESSABLE_HEIGHT,
    borderRadius: SHARED_PRESSABLE_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  secondaryBtnText: { fontWeight: "700" },
});

export function paymentSuccessThemeStyles(colors: ThemeColors, bottomInset: number) {
  return {
    root: {
      backgroundColor: colors.background,
      paddingBottom: Math.max(bottomInset, 24),
    },
    title: { color: colors.text },
    body: { color: colors.textMuted },
    secondaryBtn: { borderColor: colors.border },
    secondaryBtnText: { color: colors.text },
  } satisfies Partial<Record<keyof typeof paymentSuccessStaticStyles, object>>;
}
