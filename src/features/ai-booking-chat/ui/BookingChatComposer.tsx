import { useCallback, useRef, useState, type Ref } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useComposerVoiceInput, VoiceInputButton } from "@/features/speech-input";

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
  const voiceStopRef = useRef<(() => void) | null>(null);
  const { handleListeningChange, handleTranscriptChange, bindStopOnManualEdit } =
    useComposerVoiceInput(text, setText);
  const trimmedText = text.trim();
  const hasText = trimmedText.length > 0;
  const showPrimaryButton = !disabled && (hasText || sending);
  const sendIconColor = showPrimaryButton ? colors.primary : colors.textMuted;
  const submit = useCallback(() => {
    const t = trimmedText;
    if (!t || disabled || sending) return;
    setText("");
    onSend(t);
  }, [trimmedText, disabled, sending, onSend]);

  return (
    <View style={styles.root}>
      <View style={[styles.inputShell, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.text }]}
          placeholder={t("aiBooking.chatComposerPlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={(value) => {
            bindStopOnManualEdit(() => voiceStopRef.current?.());
            setText(value);
          }}
          multiline
          editable={!disabled && !sending}
          onFocus={() => {
            bindStopOnManualEdit(() => voiceStopRef.current?.());
            onInputFocus?.();
          }}
          onBlur={() => onInputBlur?.()}
        />
        <View style={styles.trailingGroup}>
          <VoiceInputButton
            disabled={disabled || sending}
            stopRef={voiceStopRef}
            onTranscriptChange={handleTranscriptChange}
            onListeningChange={handleListeningChange}
            style={styles.iconBtn}
            iconSize={18}
            iconName="mic"
            bare
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("aiBooking.chatSendA11y")}
            onPress={submit}
            disabled={disabled || sending || !hasText}
            style={styles.iconBtn}
            hitSlop={8}
          >
            {sending ? (
              <ActivityIndicator color={sendIconColor} size="small" />
            ) : (
              <Ionicons name="send" size={18} color={sendIconColor} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 6,
  },
  inputShell: {
    minHeight: 44,
    maxHeight: 112,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    minHeight: 32,
    maxHeight: 100,
    paddingHorizontal: 0,
    paddingVertical: 6,
    fontSize: 14,
  },
  trailingGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 8,
    paddingBottom: 3,
  },
  iconBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
});
