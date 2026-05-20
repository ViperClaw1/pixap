import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
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
  onDelete: () => void;
};

function MessagesThreadRowComponent({
  thread,
  styles,
  colors,
  isCompact,
  peerIsTyping = false,
  typingLabel = "typing...",
  onPress,
  onPressIn,
  onDelete,
}: Props) {
  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <View style={styles.swipeActionWrap}>
          <Pressable
            style={[styles.swipeActionBtn, styles.swipeDeleteBtn]}
            onPress={onDelete}
          >
            <Ionicons name="trash-outline" size={22} color={colors.onAccent} />
          </Pressable>
        </View>
      )}
    >
      <Pressable
        style={[styles.card, isCompact ? styles.cardCompact : null]}
        onPress={onPress}
        onPressIn={onPressIn}
      >
        <UserAvatarImage
          uri={thread.last_sender_avatar_url}
          style={[styles.avatar, isCompact ? styles.avatarCompact : null]}
          contentFit="cover"
        />
        <View style={styles.cardMain}>
          <View style={styles.rowBetween}>
            <Text style={[styles.title, styles.chatTitle]} numberOfLines={1}>
              {thread.last_sender_name}
            </Text>
          </View>
          <Text
            style={[styles.subtitle, peerIsTyping && styles.subtitleTyping]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {peerIsTyping ? typingLabel : thread.last_message_text}
          </Text>
        </View>
        <View style={styles.threadActionsWrap}>
          <Text style={styles.time}>{formatRelativeTime(thread.last_message_at, { style: "compact" })}</Text>
          <View style={styles.threadReadIndicator}>
            <Ionicons
              name={thread.unread_count > 0 ? "checkmark" : "checkmark-done"}
              size={16}
              color={thread.unread_count > 0 ? colors.textMuted : colors.primary}
            />
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

export const MessagesThreadRow = memo(MessagesThreadRowComponent);
