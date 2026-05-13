import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  colors: ThemeColors;
  disabled: boolean;
  sending: boolean;
  onSend: (text: string) => void;
};

export function BookingChatComposer({ colors, disabled, sending, onSend }: Props) {
  const [text, setText] = useState("");
  const submit = useCallback(() => {
    const t = text.trim();
    if (!t || disabled || sending) return;
    setText("");
    onSend(t);
  }, [text, disabled, sending, onSend]);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 6 }}>
      <TextInput
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
        placeholder="Ask about vibe, budget, music…"
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={setText}
        multiline
        editable={!disabled && !sending}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        onPress={submit}
        disabled={disabled || sending || text.trim().length === 0}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: disabled || sending || text.trim().length === 0 ? colors.border : colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {sending ? (
          <ActivityIndicator color={colors.onPrimary} size="small" />
        ) : (
          <Ionicons name="send" size={20} color={colors.onPrimary} />
        )}
      </Pressable>
    </View>
  );
}
