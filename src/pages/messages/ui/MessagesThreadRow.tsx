import { memo, useCallback, useLayoutEffect, useRef } from "react";
import { Platform, Text, View } from "react-native";
import { AppPressable } from "@/shared/ui/app-pressable";
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
  viewerId: string;
  styles: MessagesStyles;
  colors: ThemeColors;
  isCompact: boolean;
  peerIsTyping?: boolean;
  typingLabel?: string;
  onPress: () => void;
  onPressIn?: () => void;
  onDelete: () => void;
  onSwipeableOpen?: (direction: "left" | "right", swipeable: Swipeable) => void;
  onSwipeableClose?: (direction: "left" | "right", swipeable: Swipeable) => void;
};

type ThreadRowContentProps = Omit<Props, "onDelete" | "onSwipeableOpen" | "onSwipeableClose"> & {
  onLongPress?: () => void;
};

function ThreadRowContent({
  thread,
  viewerId,
  styles,
  colors,
  isCompact,
  peerIsTyping,
  typingLabel,
  onPress,
  onPressIn,
  onLongPress,
}: ThreadRowContentProps) {
  const isLastMessageMine = thread.last_sender_id === viewerId;
  const isReadByPeer =
    isLastMessageMine &&
    !!thread.peer_last_read_at &&
    new Date(thread.last_message_at).getTime() <= new Date(thread.peer_last_read_at).getTime();

  return (
    <AppPressable
      style={[styles.card, isCompact ? styles.cardCompact : null]}
      onPress={onPress}
      onPressIn={onPressIn}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <UserAvatarImage
        uri={thread.last_sender_avatar_url}
        style={[styles.avatar, isCompact ? styles.avatarCompact : null]}
        contentFit="cover"
      />
      <View style={styles.cardMain}>
        <View style={styles.rowBetween}>
          <Text style={[styles.title, styles.chatTitle]} numberOfLines={1}>
            {thread.inbox_title ?? thread.last_sender_name}
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
          {isLastMessageMine ? (
            <Ionicons
              name={isReadByPeer ? "checkmark-done" : "checkmark"}
              size={16}
              color={isReadByPeer ? colors.primary : colors.textMuted}
            />
          ) : null}
        </View>
      </View>
    </AppPressable>
  );
}

function MessagesThreadRowComponent(props: Props) {
  const swipeableRef = useRef<Swipeable>(null);
  const { thread, onDelete, onSwipeableOpen, onSwipeableClose, ...contentProps } = props;

  useLayoutEffect(() => {
    swipeableRef.current?.reset();
  }, [thread.thread_id]);

  const handleSwipeDelete = useCallback(() => {
    swipeableRef.current?.close();
    onDelete();
  }, [onDelete]);

  if (Platform.OS === "android") {
    return <ThreadRowContent {...contentProps} thread={thread} onLongPress={onDelete} />;
  }

  const { styles, colors } = props;
  return (
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      onSwipeableOpen={onSwipeableOpen}
      onSwipeableClose={onSwipeableClose}
      renderRightActions={() => (
        <View style={styles.swipeActionWrap}>
          <AppPressable style={[styles.swipeActionBtn, styles.swipeDeleteBtn]} onPress={handleSwipeDelete}>
            <Ionicons name="trash-outline" size={22} color={colors.onAccent} />
          </AppPressable>
        </View>
      )}
    >
      <ThreadRowContent {...contentProps} thread={thread} />
    </Swipeable>
  );
}

export const MessagesThreadRow = memo(MessagesThreadRowComponent);
