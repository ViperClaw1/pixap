import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

export const resetPasswordStaticStyles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  hint: { marginBottom: 16, fontSize: 14 },
  fieldWrap: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fieldWrapError: {},
  input: {
    fontSize: 16,
    flex: 1,
    paddingVertical: 0,
  },
  passwordRules: {
    marginTop: -2,
    marginBottom: 10,
    gap: 4,
  },
  passwordRuleItem: {
    fontSize: 13,
    lineHeight: 18,
  },
  inlineError: {
    marginTop: -4,
    marginBottom: 10,
    fontSize: 12,
  },
  btn: { ...primaryPressableStyle, marginTop: 8, borderRadius: 12 },
  btnDisabled: { opacity: 0.6 },
  btnText: primaryPressableTextStyle,
});

export function resetPasswordThemeStyles(colors: ThemeColors) {
  return {
    root: { backgroundColor: colors.background },
    title: { color: colors.text },
    hint: { color: colors.textMuted },
    fieldWrap: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    fieldWrapError: {
      borderColor: colors.danger,
    },
    input: { color: colors.text },
    passwordRuleItem: { color: colors.textMuted },
    inlineError: { color: colors.danger },
  } satisfies Partial<Record<keyof typeof resetPasswordStaticStyles, object>>;
}
