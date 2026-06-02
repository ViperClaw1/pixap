import { useEffect, useRef, type ComponentProps, type RefObject } from "react";
import { ActivityIndicator, Alert, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useSpeechToText } from "../lib/useSpeechToText";

type Props = {
  disabled?: boolean;
  onTranscriptChange: (text: string, meta: { isFinal: boolean }) => void;
  onListeningChange?: (listening: boolean) => void;
  stopRef?: RefObject<(() => void) | null>;
  style?: ViewStyle;
  iconSize?: number;
  iconName?: ComponentProps<typeof Ionicons>["name"];
  bordered?: boolean;
  bare?: boolean;
};

export function VoiceInputButton({
  disabled = false,
  onTranscriptChange,
  onListeningChange,
  stopRef,
  style,
  iconSize = 18,
  iconName = "mic-outline",
  bordered = true,
  bare = false,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const callbacksRef = useRef({ onTranscriptChange, onListeningChange });
  callbacksRef.current = { onTranscriptChange, onListeningChange };

  const { isListening, isAvailable, runtimeChecked, stop, toggle } = useSpeechToText({
    onTranscript: (text, meta) => callbacksRef.current.onTranscriptChange(text, meta),
    onListeningChange: (listening) => callbacksRef.current.onListeningChange?.(listening),
    onError: (code, message) => {
      if (code === "service-not-allowed" || code === "language-not-supported") {
        Alert.alert(t("speechInput.errorTitle"), message || t("speechInput.serviceNotAllowed"));
        return;
      }
      if (code === "not-allowed") {
        Alert.alert(t("speechInput.permissionTitle"), t("speechInput.permissionMessage"));
        return;
      }
      if (code === "no-speech" || code === "speech-timeout") {
        Toast.show({ type: "info", text1: t("speechInput.noSpeech") });
        return;
      }
      if (code === "network") {
        Toast.show({ type: "error", text1: t("speechInput.networkError") });
        return;
      }
      Toast.show({
        type: "error",
        text1: t("speechInput.errorGeneric"),
        text2: message,
      });
    },
  });

  useEffect(() => {
    if (!stopRef) return;
    stopRef.current = stop;
    return () => {
      stopRef.current = null;
    };
  }, [stop, stopRef]);

  if (!runtimeChecked || !isAvailable) {
    return null;
  }

  const isDisabled = disabled;
  const iconColor = isListening ? colors.primary : colors.textMuted;

  return (
    <AppPressable
      accessibilityRole="button"
      accessibilityLabel={isListening ? t("speechInput.stopA11y") : t("speechInput.startA11y")}
      accessibilityState={{ disabled: isDisabled, selected: isListening }}
      hitSlop={bare ? 6 : undefined}
      style={
        bare
          ? [{ padding: 0, alignItems: "center", justifyContent: "center" }, style]
          : [
              {
                width: 44,
                height: 44,
                borderRadius: 8,
                borderWidth: bordered ? 1 : 0,
                borderColor: isListening ? colors.primary : colors.border,
                backgroundColor: colors.background,
                alignItems: "center",
                justifyContent: "center",
              },
              style,
            ]
      }
      disabled={isDisabled}
      onPress={() => {
        void toggle();
      }}
    >
      {isListening ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name={iconName} size={iconSize} color={iconColor} />
      )}
    </AppPressable>
  );
}
