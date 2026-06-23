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
  primaryDisabled: { opacity: 0.75 },
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
  inlineError: { marginTop: -4, marginBottom: 10, fontSize: 12 },
  passwordRules: { marginTop: -2, marginBottom: 8, gap: 4 },
  passwordRuleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  passwordRuleText: { fontSize: 14 },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  tabSwitcher: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabSlider: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
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
    inlineError: { color: colors.danger },
    passwordRuleText: { color: colors.textMuted },
    tabSwitcher: { backgroundColor: colors.card },
    tabSlider: { backgroundColor: colors.primary },
    tabText: { color: colors.textMuted },
  } satisfies Partial<Record<keyof typeof authStaticStyles, object>>;
}
