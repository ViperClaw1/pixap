import { memo, useMemo } from "react";
import { Text, View } from "react-native";
import type { ToastConfig } from "react-native-toast-message";
import type { ThemeColors } from "@/shared/theme/palettes";

const ACCENT_BORDER = "#ec6544";

const toastShellStyle = {
  width: "auto" as const,
  alignSelf: "stretch" as const,
  marginHorizontal: 14,
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 14,
  borderWidth: 1,
  borderColor: ACCENT_BORDER,
};

type ToastLinesProps = {
  colors: ThemeColors;
  text1?: string;
  text2?: string;
  text1Color: string;
};

const ToastLines = memo(function ToastLines({ colors, text1, text2, text1Color }: ToastLinesProps) {
  return (
    <View style={[toastShellStyle, { backgroundColor: colors.card }]}>
      {text1 ? <Text style={{ color: text1Color, fontSize: 14, fontWeight: "700" }}>{text1}</Text> : null}
      {text2 ? <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{text2}</Text> : null}
    </View>
  );
});

export function createAppToastConfig(colors: ThemeColors): ToastConfig {
  return {
    success: ({ text1, text2 }) => (
      <ToastLines colors={colors} text1={text1} text2={text2} text1Color={colors.text} />
    ),
    error: ({ text1, text2 }) => (
      <ToastLines colors={colors} text1={text1} text2={text2} text1Color={colors.danger} />
    ),
  };
}

/** Stable toast config inside a component that already reads theme colors. */
export function useAppToastConfig(colors: ThemeColors): ToastConfig {
  return useMemo(() => createAppToastConfig(colors), [colors]);
}
