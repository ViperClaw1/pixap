import { forwardRef, useCallback, useRef } from "react";
import {
  Platform,
  TextInput,
  type TextInputKeyPressEventData,
  type TextInputProps,
  type NativeSyntheticEvent,
} from "react-native";
import {
  resolveMaskedPasswordChange,
  toMaskedPasswordDisplay,
} from "@/shared/lib/passwordInput/resolveMaskedPasswordChange";

export type PasswordTextInputProps = Omit<TextInputProps, "secureTextEntry"> & {
  /** When true, the password is shown in plain text. */
  visible: boolean;
};

/**
 * Password field with instant masking on Android (`*` immediately, no character flash).
 * iOS keeps native `secureTextEntry` behavior.
 */
export const PasswordTextInput = forwardRef<TextInput, PasswordTextInputProps>(
  function PasswordTextInput({ visible, value, onChangeText, onKeyPress, ...rest }, ref) {
    const pendingKeyRef = useRef<string | null>(null);
    const passwordRef = useRef(typeof value === "string" ? value : "");
    passwordRef.current = typeof value === "string" ? value : "";

    const useInstantMask = Platform.OS === "android" && !visible;
    const displayValue = useInstantMask
      ? toMaskedPasswordDisplay(passwordRef.current)
      : value;

    const handleKeyPress = useCallback(
      (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
        if (useInstantMask) {
          const { key } = event.nativeEvent;
          if (key.length === 1 && key !== "Backspace") {
            pendingKeyRef.current = key;
          }
        }
        onKeyPress?.(event);
      },
      [onKeyPress, useInstantMask],
    );

    const handleChangeText = useCallback(
      (text: string) => {
        if (!onChangeText) return;

        if (!useInstantMask) {
          onChangeText(text);
          return;
        }

        onChangeText(
          resolveMaskedPasswordChange(text, passwordRef.current, pendingKeyRef.current),
        );
        pendingKeyRef.current = null;
      },
      [onChangeText, useInstantMask],
    );

    return (
      <TextInput
        ref={ref}
        {...rest}
        value={displayValue}
        onChangeText={handleChangeText}
        onKeyPress={handleKeyPress}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={Platform.OS === "ios" ? !visible : false}
        {...(Platform.OS === "android" ? { textBreakStrategy: "simple" as const } : null)}
      />
    );
  },
);
