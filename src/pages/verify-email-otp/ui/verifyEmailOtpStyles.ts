import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

export const verifyEmailOtpStaticStyles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  backButton: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
  },
  otpWrap: {
    marginBottom: 16,
    minHeight: 56,
    justifyContent: "center",
  },
  resendBtn: {
    minHeight: 42,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  resendBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  verifyBtn: {
    ...primaryPressableStyle,
    minHeight: 46,
    borderRadius: 12,
    marginTop: 14,
  },
  verifyBtnText: {
    ...primaryPressableTextStyle,
    fontSize: 15,
  },
});

export function verifyEmailOtpThemeStyles(colors: ThemeColors, topInset: number) {
  return {
    root: { backgroundColor: colors.background },
    backButton: {
      top: Math.max(topInset, 12),
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    title: { color: colors.text },
    description: { color: colors.textMuted },
    resendBtnText: { color: colors.primary },
  } satisfies Partial<Record<keyof typeof verifyEmailOtpStaticStyles, object>>;
}
