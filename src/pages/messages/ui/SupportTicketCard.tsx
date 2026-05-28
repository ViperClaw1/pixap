import { Text, View } from "react-native";
import { AppPressable } from "@/shared/ui/app-pressable";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { MessageThreadItem } from "@/shared/model/types/messages";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import { formatRelativeTime } from "@/shared/lib/formatRelativeTime";
import type { useMessagesStyles } from "./messagesStyles";

type MessagesStyles = ReturnType<typeof useMessagesStyles>;

type Props = {
  thread: MessageThreadItem;
  styles: MessagesStyles;
  colors: ThemeColors;
  isCompact: boolean;
  peerIsTyping?: boolean;
  typingLabel?: string;
  onPress: () => void;
  onPressIn?: () => void;
};

export function SupportTicketCard({
  thread,
  styles,
  colors,
  isCompact,
  peerIsTyping = false,
  typingLabel = "typing...",
  onPress,
  onPressIn,
}: Props) {
  const previewText = peerIsTyping
    ? typingLabel
    : thread.last_message_text?.trim() || "";
  const previewLine = peerIsTyping
    ? previewText
    : thread.last_sender_name
      ? `${thread.last_sender_name}: ${previewText}`
      : previewText;

  return (
    <AppPressable
      style={[styles.supportTicketCard, isCompact ? styles.supportTicketCardCompact : null]}
      onPress={onPress}
      onPressIn={onPressIn}
      accessibilityRole="button"
      accessibilityLabel={thread.inbox_title ?? thread.last_sender_name}
    >
      <UserAvatarImage
        uri={thread.last_sender_avatar_url}
        style={[styles.supportTicketAvatar, isCompact ? styles.supportTicketAvatarCompact : null]}
        contentFit="cover"
      />
      <View style={styles.supportMain}>
        <Text style={[styles.supportTitle, isCompact ? styles.supportTitleCompact : null]} numberOfLines={1}>
          {thread.inbox_title ?? thread.last_sender_name}
        </Text>
        <Text
          style={[styles.supportSubtitle, isCompact ? styles.supportSubtitleCompact : null]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {previewLine}
        </Text>
      </View>
      <View style={styles.supportTicketMeta}>
        <Text style={styles.supportTicketTime}>{formatRelativeTime(thread.last_message_at, { style: "compact" })}</Text>
        {thread.unread_count > 0 ? (
          <View style={[styles.supportTicketUnread, { backgroundColor: colors.primary }]}>
            <Text style={[styles.supportTicketUnreadText, { color: colors.onPrimary }]}>
              {thread.unread_count > 99 ? "99+" : thread.unread_count}
            </Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={isCompact ? 16 : 18} color={colors.textMuted} />
        )}
      </View>
    </AppPressable>
  );
}
