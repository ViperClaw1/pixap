import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { AUTH_PRIMARY_COLOR, primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

export const passwordResetSentStaticStyles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  iconWrap: {
    alignSelf: "center",
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  email: {
    fontWeight: "700",
  },
  button: {
    ...primaryPressableStyle,
    marginTop: 28,
    borderWidth: 1,
    borderColor: AUTH_PRIMARY_COLOR,
  },
  buttonText: primaryPressableTextStyle,
});

export function passwordResetSentThemeStyles(colors: ThemeColors, topInset: number, bottomInset: number) {
  return {
    root: {
      backgroundColor: colors.background,
      paddingTop: Math.max(topInset, 24),
      paddingBottom: Math.max(bottomInset, 24),
    },
    description: { color: colors.text },
  } satisfies Partial<Record<keyof typeof passwordResetSentStaticStyles, object>>;
}
