import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useAppTheme } from "@/contexts/ThemeContext";
import { SHARED_PRESSABLE_HEIGHT, primaryPressableStyle, primaryPressableTextStyle } from "@/theme/primaryPressable";
import { RichTextarea } from "@/components/RichTextarea";

interface ReplyInputProps {
  submitting: boolean;
  onSubmit: (value: string) => Promise<void> | void;
}

function ReplyInputComponent({ submitting, onSubmit }: ReplyInputProps) {
  const { colors } = useAppTheme();
  const [value, setValue] = useState("");
  const canSend = value.trim().length > 0 && !submitting;

  const submit = async () => {
    const text = value.trim();
    if (!text || submitting) return;
    await onSubmit(text);
    setValue("");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <RichTextarea
          value={value}
          onChangeText={setValue}
          placeholder="Reply to story..."
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              color: colors.text,
            },
          ]}
        />
      </View>
      <Pressable
        style={[styles.sendBtn, { opacity: canSend ? 1 : 0.6 }]}
        onPress={() => void submit()}
        disabled={!canSend}
      >
        <FontAwesome name={submitting ? "spinner" : "paper-plane"} size={18} style={styles.sendIcon} />
      </Pressable>
    </View>
  );
}

export const ReplyInput = memo(ReplyInputComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    position: "relative",
  },
  composer: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: SHARED_PRESSABLE_HEIGHT,
  },
  input: {
    minHeight: SHARED_PRESSABLE_HEIGHT,
    maxHeight: 120,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingRight: 64,
    fontSize: 14,
  },
  sendBtn: {
    ...primaryPressableStyle,
    position: "absolute",
    right: 8,
    bottom: 8,
    minWidth: 42,
    width: 42,
    minHeight: 42,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 0,
  },
  sendIcon: {
    ...primaryPressableTextStyle,
    lineHeight: 18,
  },
});
