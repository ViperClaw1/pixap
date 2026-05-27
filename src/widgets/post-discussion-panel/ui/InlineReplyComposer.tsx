import { useCallback, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";
import type { DiscussionUiPalette } from "@/shared/theme/discussionPalette";
import { QUICK_EMOJI } from "../model/quickEmoji";

type Props = {
  palette: DiscussionUiPalette;
  replyingToLabel: string;
  value: string;
  submitting: boolean;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  indentStyle?: object;
};

export function InlineReplyComposer({
  palette,
  replyingToLabel,
  value,
  submitting,
  onChangeText,
  onSubmit,
  onClose,
  indentStyle,
}: Props) {
  const inputRef = useRef<TextInput>(null);

  const refocusInput = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const appendEmoji = useCallback(
    (emoji: string) => {
      onChangeText(`${value}${emoji}`);
      refocusInput();
    },
    [onChangeText, refocusInput, value],
  );

  return (
    <View style={[styles.root, indentStyle]}>
      <View style={styles.replyingBar}>
        <Text style={[styles.replyingText, { color: palette.textMuted }]} numberOfLines={1}>
          {replyingToLabel}
        </Text>
        <Pressable hitSlop={8} onPress={onClose}>
          <Ionicons name="close" size={18} color={palette.textMuted} />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        contentContainerStyle={styles.emojiRow}
      >
        {QUICK_EMOJI.map((em) => (
          <Pressable key={em} hitSlop={4} style={styles.emojiChip} onPress={() => appendEmoji(em)}>
            <Text style={styles.emojiText}>{em}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.inlineInputShell}>
        <RichTextarea
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder="Add a reply…"
          placeholderTextColor={palette.textMuted}
          textAlignVertical="center"
          editable={!submitting}
          style={[styles.inlineInput, { backgroundColor: palette.inputBg, color: palette.text }]}
        />
        <Pressable
          style={[
            styles.sendCircle,
            { backgroundColor: palette.sendAccent },
            (!value.trim() || submitting) && styles.sendCircleDisabled,
          ]}
          disabled={!value.trim() || submitting}
          onPress={onSubmit}
        >
          <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 8,
    marginLeft: 42,
  },
  replyingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  replyingText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    marginRight: 8,
  },
  emojiRow: {
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  emojiChip: {
    paddingHorizontal: 2,
  },
  emojiText: {
    fontSize: 22,
  },
  inlineInputShell: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  inlineInput: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 0,
    minHeight: 40,
    maxHeight: 120,
    paddingLeft: 14,
    paddingRight: 48,
    paddingVertical: 9,
    fontSize: 14,
  },
  sendCircle: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  sendCircleDisabled: {
    opacity: 0.45,
  },
});
