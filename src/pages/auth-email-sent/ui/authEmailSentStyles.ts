import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { AUTH_PRIMARY_COLOR, primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

export const authEmailSentStaticStyles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 12,
    lineHeight: 42,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
  },
  email: {
    fontWeight: "700",
  },
  button: {
    ...primaryPressableStyle,
    marginTop: 26,
    borderWidth: 1,
    borderColor: AUTH_PRIMARY_COLOR,
  },
  buttonText: primaryPressableTextStyle,
});

export function authEmailSentThemeStyles(colors: ThemeColors) {
  return {
    root: { backgroundColor: colors.background },
    title: { color: colors.text },
    description: { color: colors.textMuted },
    email: { color: colors.text },
  } satisfies Partial<Record<keyof typeof authEmailSentStaticStyles, object>>;
}
