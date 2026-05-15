import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import {
  AUTH_PRIMARY_COLOR,
  SHARED_PRESSABLE_HEIGHT,
  SHARED_PRESSABLE_RADIUS,
  primaryPressableStyle,
  primaryPressableTextStyle,
} from "@/shared/theme/primaryPressable";

export const authStaticStyles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  content: { flexGrow: 1, justifyContent: "center" },
  title: { fontSize: 36, fontWeight: "800", marginBottom: 6, lineHeight: 54 },
  helper: { fontSize: 14, marginBottom: 26, lineHeight: 30 },
  fieldWrap: {
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    minHeight: 58,
  },
  fieldWrapError: {},
  fieldIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
  },
  primary: {
    ...primaryPressableStyle,
    marginTop: 14,
  },
  primaryText: primaryPressableTextStyle,
  smallLink: { marginTop: 10, alignSelf: "flex-start" },
  smallLinkText: { color: AUTH_PRIMARY_COLOR, fontSize: 14, fontWeight: "500" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 14, paddingHorizontal: 6 },
  outline: {
    borderWidth: 1,
    minHeight: SHARED_PRESSABLE_HEIGHT,
    borderRadius: SHARED_PRESSABLE_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
  },
  outlineText: { fontWeight: "700", fontSize: 14 },
  bottomSwitch: { marginTop: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  bottomSwitchText: { fontSize: 14 },
  bottomSwitchLink: { color: AUTH_PRIMARY_COLOR, fontSize: 14, fontWeight: "700" },
  inlineError: { marginTop: -4, marginBottom: 10, fontSize: 12 },
  passwordRules: { marginTop: -2, marginBottom: 8, gap: 4 },
  passwordRuleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  passwordRuleText: { fontSize: 14 },
});

export function authThemeStyles(colors: ThemeColors) {
  return {
    root: { backgroundColor: colors.background },
    title: { color: colors.text },
    helper: { color: colors.textMuted },
    fieldWrap: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    fieldWrapError: {
      borderColor: colors.accent,
    },
    input: { color: colors.text },
    orLine: { backgroundColor: colors.border },
    orText: { color: colors.textMuted },
    outline: {
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    outlineText: { color: colors.text },
    bottomSwitchText: { color: colors.textMuted },
    inlineError: { color: colors.danger },
    passwordRuleText: { color: colors.textMuted },
  } satisfies Partial<Record<keyof typeof authStaticStyles, object>>;
}
