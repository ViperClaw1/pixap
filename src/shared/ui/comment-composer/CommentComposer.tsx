import { ActivityIndicator, Keyboard, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { COMMENT_STICKERS } from "@/shared/constants/commentStickers";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";

const STICKER_ROW_HEIGHT = 36;
const SEND_BTN_SIZE = 34;

type Props = {
  avatarUrl: string | null;
  /** When false, the avatar is hidden and the text area spans full width. */
  showAvatar?: boolean;
  /** Emoji sticker chips inside the input, left of the send button. */
  showStickers?: boolean;
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
  showStickers = false,
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
  const footerInset = showStickers ? STICKER_ROW_HEIGHT + 8 : 0;
  const trailingInset = showSendButton ? SEND_BTN_SIZE + 12 : 12;

  const handleSendPress = () => {
    Keyboard.dismiss();
    onSend();
  };

  const appendSticker = (emoji: string) => {
    onChangeText(`${value}${emoji}`);
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
              paddingRight: trailingInset,
              paddingBottom: 12 + footerInset,
            },
          ]}
        />
        {showStickers ? (
          <View
            style={[
              styles.stickerRow,
              { right: showSendButton ? SEND_BTN_SIZE + 16 : 8, bottom: 8 },
            ]}
            pointerEvents="box-none"
          >
            {COMMENT_STICKERS.map((sticker) => (
              <Pressable
                key={sticker.id}
                style={styles.stickerHit}
                onPress={() => appendSticker(sticker.emoji)}
                hitSlop={4}
                accessibilityLabel={sticker.emoji}
              >
                <SmartImage uri={sticker.imageUrl} style={styles.stickerImage} contentFit="contain" />
              </Pressable>
            ))}
          </View>
        ) : null}
        {showSendButton ? (
          <Pressable
            onPress={handleSendPress}
            style={[styles.commentComposerSendBtn, { opacity: canSend || sending ? 1 : 0.5 }]}
            disabled={!canSend}
            hitSlop={10}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="paper-plane-outline" size={19} color={colors.primary} />
            )}
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
    width: SEND_BTN_SIZE,
    height: SEND_BTN_SIZE,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  stickerRow: {
    position: "absolute",
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  stickerHit: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  stickerImage: {
    width: 24,
    height: 24,
  },
});
