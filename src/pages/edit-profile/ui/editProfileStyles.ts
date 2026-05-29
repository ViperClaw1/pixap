import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { ThemeMode } from "@/app/providers/ThemeProvider";
import { AUTH_PRIMARY_COLOR, primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

export const editProfileStaticStyles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 12, paddingBottom: 36, paddingHorizontal: 12 },
  avatarBlock: { alignItems: "center", marginBottom: 12 },
  avatarFrame: {
    position: "relative",
    width: 96,
    height: 96,
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarCameraBtn: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { marginTop: 12, fontWeight: "600", fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    fontSize: 14,
  },
  disabledInput: {},
  inputError: {},
  errorText: { marginTop: 6, fontSize: 12 },
  phoneInputWrap: { marginTop: 6 },
  phonePlaceholder: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btn: {
    marginTop: 24,
    ...primaryPressableStyle,
    borderWidth: 1,
    borderColor: AUTH_PRIMARY_COLOR,
  },
  btnText: primaryPressableTextStyle,
});

export function editProfileThemeStyles(colors: ThemeColors, _mode: ThemeMode) {
  return {
    root: { backgroundColor: colors.background },
    avatar: { backgroundColor: colors.surface },
    avatarCameraBtn: {
      backgroundColor: colors.primary,
      borderColor: colors.border,
    },
    label: { color: colors.textMuted },
    input: {
      borderColor: colors.border,
      color: colors.text,
      backgroundColor: colors.card,
    },
    disabledInput: { backgroundColor: colors.surface, color: colors.textMuted },
    inputError: { borderColor: colors.danger },
    errorText: { color: colors.danger },
    phonePlaceholder: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
  } satisfies Partial<Record<keyof typeof editProfileStaticStyles, object>>;
}
