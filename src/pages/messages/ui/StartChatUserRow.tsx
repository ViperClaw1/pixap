import { memo } from "react";
import { Text, View } from "react-native";
import { AppPressable } from "@/shared/ui/app-pressable";
import type { PublicProfileItem } from "@/entities/user";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import type { useMessagesStyles } from "./messagesStyles";

type MessagesStyles = ReturnType<typeof useMessagesStyles>;

type Props = {
  person: PublicProfileItem;
  styles: MessagesStyles;
  isCompact: boolean;
  unknownLabel: string;
  onPress: () => void;
  onPressIn?: () => void;
};

function StartChatUserRowComponent({ person, styles, isCompact, unknownLabel, onPress, onPressIn }: Props) {
  const displayName =
    `${person.first_name?.trim() ?? ""} ${person.last_name?.trim() ?? ""}`.trim() || unknownLabel;
  const username = person.username?.trim() || unknownLabel;

  return (
    <AppPressable
      style={[styles.card, isCompact ? styles.cardCompact : null, styles.startChatCard]}
      onPress={onPress}
      onPressIn={onPressIn}
    >
      <UserAvatarImage
        uri={person.avatar_url}
        style={[styles.avatar, isCompact ? styles.avatarCompact : null]}
        contentFit="cover"
      />
      <View style={styles.cardMain}>
        <Text style={[styles.title, isCompact ? styles.titleCompact : null]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[styles.username, isCompact ? styles.usernameCompact : null]} numberOfLines={1}>
          @{username}
        </Text>
      </View>
    </AppPressable>
  );
}

export const StartChatUserRow = memo(StartChatUserRowComponent);
