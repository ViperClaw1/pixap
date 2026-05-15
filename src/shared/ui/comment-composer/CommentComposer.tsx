import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";

type Props = {
  avatarUrl: string | null;
  /** When false, the avatar is hidden and the text area spans full width. */
  showAvatar?: boolean;
  /** When false, the send button is hidden (e.g. use an external primary action). */
  showSendButton?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  canSend: boolean;
  sending: boolean;
  onSend: () => void;
  minHeight?: number;
  maxHeight?: number;
  hasError?: boolean;
};

export function CommentComposer({
  avatarUrl,
  showAvatar = true,
  showSendButton = true,
  value,
  onChangeText,
  placeholder,
  canSend,
  sending,
  onSend,
  minHeight = 100,
  maxHeight = 150,
  hasError = false,
}: Props) {
  const { colors } = useAppTheme();
  const handleSendPress = () => {
    Keyboard.dismiss();
    onSend();
  };

  return (
    <View style={styles.commentComposerRow}>
      {showAvatar ? (
        avatarUrl ? (
          <SmartImage uri={avatarUrl} style={styles.commentComposerAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.commentComposerAvatar, { backgroundColor: colors.card }]} />
        )
      ) : null}
      <View style={styles.commentComposerInputWrap}>
        <RichTextarea
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          containerStyle={styles.commentComposerTextareaContainer}
          style={[
            styles.commentComposerTextarea,
            {
              minHeight,
              maxHeight,
              color: colors.text,
              borderColor: hasError ? colors.danger : colors.border,
              backgroundColor: colors.background,
              paddingRight: showSendButton ? 44 : 12,
            },
          ]}
        />
        {showSendButton ? (
          <Pressable
            onPress={handleSendPress}
            style={[styles.commentComposerSendBtn, { opacity: canSend ? 1 : 0.5 }]}
            disabled={!canSend}
            hitSlop={10}
          >
            <Ionicons name={sending ? "sync-outline" : "paper-plane-outline"} size={19} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  commentComposerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  commentComposerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  commentComposerInputWrap: {
    flex: 1,
    position: "relative",
  },
  commentComposerTextareaContainer: {
    width: "100%",
  },
  commentComposerTextarea: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingRight: 44,
    fontSize: 14,
  },
  commentComposerSendBtn: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
