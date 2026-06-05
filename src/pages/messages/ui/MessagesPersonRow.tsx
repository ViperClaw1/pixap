import { memo, useCallback, useLayoutEffect, useRef } from "react";
import { Platform, Text, View } from "react-native";
import { AppPressable } from "@/shared/ui/app-pressable";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { FollowSuggestion } from "@/entities/messages/api/usePeopleToFollow";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import type { useMessagesStyles } from "./messagesStyles";

type MessagesStyles = ReturnType<typeof useMessagesStyles>;

type Props = {
  person: FollowSuggestion;
  styles: MessagesStyles;
  colors: ThemeColors;
  isCompact: boolean;
  actionIconSize: number;
  unknownLabel: string;
  isFollowing: boolean;
  followedLabel: string;
  onOpenChat: () => void;
  onPrefetchChat?: () => void;
  onToggleFollow: () => void;
  onPressProfile?: () => void;
  onSwipeableOpen?: (direction: "left" | "right", swipeable: Swipeable) => void;
  onSwipeableClose?: (direction: "left" | "right", swipeable: Swipeable) => void;
};

function PersonRowContent({
  person,
  styles,
  colors,
  isCompact,
  actionIconSize,
  unknownLabel,
  isFollowing,
  followedLabel,
  onOpenChat,
  onPrefetchChat,
  onToggleFollow,
  onPressProfile,
}: Props) {
  const displayName = `${person.first_name?.trim() ?? ""} ${person.last_name?.trim() ?? ""}`.trim() || unknownLabel;

  return (
    <View style={[styles.card, isCompact ? styles.cardCompact : null]}>
      <AppPressable onPress={onPressProfile} disabled={!onPressProfile}>
        <UserAvatarImage
          uri={person.avatar_url}
          style={[styles.avatar, isCompact ? styles.avatarCompact : null]}
          contentFit="cover"
        />
      </AppPressable>
      <AppPressable
        style={styles.cardMain}
        onPress={onPressProfile}
        disabled={!onPressProfile}
      >
        <Text style={[styles.title, isCompact ? styles.titleCompact : null]} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={[styles.userMetaRow, isCompact ? styles.userMetaRowCompact : null]}>
          <Text style={[styles.username, isCompact ? styles.usernameCompact : null]} numberOfLines={1}>
            @{person.username?.trim() || unknownLabel}
          </Text>
          {isFollowing ? (
            <View style={[styles.followedBadge, isCompact ? styles.followedBadgeCompact : null]}>
              <Text style={[styles.followedBadgeText, isCompact ? styles.followedBadgeTextCompact : null]}>
                {followedLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </AppPressable>
      <View style={[styles.actionsWrap, isCompact ? styles.actionsWrapCompact : null]}>
        <AppPressable
          style={[styles.iconActionBtn, styles.followBtn, isCompact ? styles.iconActionBtnCompact : null]}
          onPress={onToggleFollow}
        >
          <Ionicons
            name={isFollowing ? "person-remove" : "person-add"}
            size={actionIconSize}
            color={colors.onAccent}
          />
        </AppPressable>
        <AppPressable
          style={[styles.iconActionBtn, styles.chatBtn, isCompact ? styles.iconActionBtnCompact : null]}
          onPress={onOpenChat}
          onPressIn={onPrefetchChat}
        >
          <Ionicons name="chatbubble-ellipses" size={actionIconSize} color={colors.onAccent} />
        </AppPressable>
      </View>
    </View>
  );
}

function MessagesPersonRowComponent(props: Props) {
  const swipeableRef = useRef<Swipeable>(null);
  const {
    person,
    styles,
    colors,
    isCompact,
    actionIconSize,
    onOpenChat,
    onPrefetchChat,
    onToggleFollow,
    isFollowing,
    onSwipeableOpen,
    onSwipeableClose,
  } = props;

  useLayoutEffect(() => {
    swipeableRef.current?.reset();
  }, [person.id]);

  const handleSwipeChat = useCallback(() => {
    swipeableRef.current?.close();
    onOpenChat();
  }, [onOpenChat]);

  const handleSwipeFollow = useCallback(() => {
    swipeableRef.current?.close();
    onToggleFollow();
  }, [onToggleFollow]);

  if (Platform.OS === "android") {
    return <PersonRowContent {...props} />;
  }

  const swipeWrapRight = [
    styles.swipeActionWrap,
    styles.swipeActionWrapRight,
    isCompact ? styles.swipeActionWrapRightCompact : null,
  ];
  const swipeWrapLeft = [
    styles.swipeActionWrap,
    styles.swipeActionWrapLeft,
    isCompact ? styles.swipeActionWrapLeftCompact : null,
  ];

  return (
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      overshootLeft={false}
      onSwipeableOpen={onSwipeableOpen}
      onSwipeableClose={onSwipeableClose}
      renderRightActions={() => (
        <View style={swipeWrapRight}>
          <AppPressable
            style={[styles.swipeActionBtn, styles.swipeChatBtn, isCompact ? styles.swipeActionBtnCompact : null]}
            onPress={handleSwipeChat}
            onPressIn={onPrefetchChat}
          >
            <Ionicons name="chatbubble-ellipses" size={actionIconSize} color={colors.onAccent} />
          </AppPressable>
        </View>
      )}
      renderLeftActions={() => (
        <View style={swipeWrapLeft}>
          <AppPressable
            style={[styles.swipeActionBtn, styles.swipeFollowBtn, isCompact ? styles.swipeActionBtnCompact : null]}
            onPress={handleSwipeFollow}
          >
            <Ionicons
              name={isFollowing ? "person-remove" : "person-add"}
              size={actionIconSize}
              color={colors.onAccent}
            />
          </AppPressable>
        </View>
      )}
    >
      <PersonRowContent {...props} />
    </Swipeable>
  );
}

export const MessagesPersonRow = memo(MessagesPersonRowComponent);
