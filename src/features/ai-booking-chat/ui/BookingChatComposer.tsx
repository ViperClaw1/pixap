import { useCallback, useState, type Ref } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";

type Props = {
  disabled: boolean;
  sending: boolean;
  onSend: (text: string) => void;
  /** Ref на поле ввода — для измерения и минимального скролла при клавиатуре (экран бронирования). */
  inputRef?: Ref<TextInput>;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
};

export function BookingChatComposer({
  disabled,
  sending,
  onSend,
  inputRef,
  onInputFocus,
  onInputBlur,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [text, setText] = useState("");
  const trimmedText = text.trim();
  const hasText = trimmedText.length > 0;
  const showPrimaryButton = !disabled && (hasText || sending);
  const sendIconColor = showPrimaryButton ? colors.onPrimary : colors.textMuted;
  const submit = useCallback(() => {
    const t = trimmedText;
    if (!t || disabled || sending) return;
    setText("");
    onSend(t);
  }, [trimmedText, disabled, sending, onSend]);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 6 }}>
      <TextInput
        ref={inputRef}
        style={{
          flex: 1,
          minHeight: 40,
          maxHeight: 100,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          color: colors.text,
          backgroundColor: colors.background,
        }}
        placeholder={t("aiBooking.chatComposerPlaceholder")}
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={setText}
        multiline
        editable={!disabled && !sending}
        onFocus={() => onInputFocus?.()}
        onBlur={() => onInputBlur?.()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("aiBooking.chatSendA11y")}
        onPress={submit}
        disabled={disabled || sending || !hasText}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: showPrimaryButton ? colors.primary : colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {sending ? (
          <ActivityIndicator color={sendIconColor} size="small" />
        ) : (
          <Ionicons name="send" size={20} color={sendIconColor} />
        )}
      </Pressable>
    </View>
  );
}
