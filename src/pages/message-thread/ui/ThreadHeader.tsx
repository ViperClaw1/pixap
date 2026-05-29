import { AppPressable } from "@/shared/ui/app-pressable";
import { memo } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeColors } from "@/shared/theme/palettes";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import type { MessageThreadStyles } from "@/shared/theme/messageThreadStyles";
import { UgcModerationOverflow } from "@/features/ugc-moderation";

type Props = {
  styles: MessageThreadStyles;
  colors: ThemeColors;
  peerName: string;
  presenceLabel: string;
  presenceIsOnline: boolean;
  isSupport: boolean;
  peerAvatar: string | null;
  peerUserId?: string | null;
  onBack: () => void;
};

function ThreadHeaderComponent({
  styles,
  colors,
  peerName,
  presenceLabel,
  presenceIsOnline,
  isSupport,
  peerAvatar,
  peerUserId,
  onBack,
}: Props) {
  return (
    <View style={styles.header}>
      <AppPressable style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={20} color={colors.text} />
      </AppPressable>
      <View style={styles.headerCenter}>
        <Text style={styles.peerName} numberOfLines={1}>
          {peerName}
        </Text>
        <Text style={[styles.peerSeen, presenceIsOnline && styles.peerTyping]}>{presenceLabel}</Text>
      </View>
      {!isSupport && peerUserId ? (
        <UgcModerationOverflow
          subject={{
            targetType: "user",
            reportedUserId: peerUserId,
            authorLabel: peerName,
          }}
        />
      ) : isSupport ? (
        <View style={[styles.peerAvatar, styles.supportPeerAvatar, { backgroundColor: colors.accent }]}>
          <Ionicons name="headset-outline" size={20} color={colors.onAccent} />
        </View>
      ) : (
        <UserAvatarImage uri={peerAvatar} style={styles.peerAvatar} contentFit="cover" />
      )}
    </View>
  );
}

export const ThreadHeader = memo(ThreadHeaderComponent);
