import { ActivityIndicator, Text, View } from "react-native";
import { AppPressable } from "@/shared/ui/app-pressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { MessageThreadItem } from "@/shared/model/types/messages";
import { formatRelativeTime } from "@/shared/lib/formatRelativeTime";
import type { useMessagesStyles } from "./messagesStyles";

type MessagesStyles = ReturnType<typeof useMessagesStyles>;

type Props = {
  styles: MessagesStyles;
  colors: ThemeColors;
  isCompact: boolean;
  isOpening: boolean;
  existingThread: MessageThreadItem | null;
  onPress: () => void;
};

export function SupportChatCard({ styles, colors, isCompact, isOpening, existingThread, onPress }: Props) {
  const { t } = useTranslation();
  const hasThread = existingThread != null;
  const subtitle = hasThread
    ? existingThread.last_message_text?.trim() || t("messages.supportSubtitle")
    : t("messages.supportSubtitle");

  return (
    <AppPressable
      style={[styles.supportCard, isCompact ? styles.supportCardCompact : null]}
      onPress={onPress}
      disabled={isOpening}
      accessibilityRole="button"
      accessibilityLabel={t("messages.support")}
    >
      <View style={[styles.supportIconWrap, isCompact ? styles.supportIconWrapCompact : null]}>
        <Ionicons name="headset-outline" size={isCompact ? 20 : 22} color={colors.onAccent} />
      </View>
      <View style={styles.supportMain}>
        <Text style={[styles.supportTitle, isCompact ? styles.supportTitleCompact : null]} numberOfLines={1}>
          {t("messages.support")}
        </Text>
        <Text
          style={[styles.supportSubtitle, isCompact ? styles.supportSubtitleCompact : null]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {subtitle}
        </Text>
      </View>
      {hasThread ? (
        <View style={styles.threadActionsWrap}>
          <Text style={styles.time}>
            {formatRelativeTime(existingThread.last_message_at, { style: "compact" })}
          </Text>
          <View style={styles.threadReadIndicator}>
            <Ionicons
              name={existingThread.unread_count > 0 ? "checkmark" : "checkmark-done"}
              size={16}
              color={existingThread.unread_count > 0 ? colors.textMuted : colors.primary}
            />
          </View>
          {existingThread.unread_count > 0 ? (
            <View style={[styles.supportTicketUnread, { backgroundColor: colors.primary }]}>
              <Text style={[styles.supportTicketUnreadText, { color: colors.onPrimary }]}>
                {existingThread.unread_count > 99 ? "99+" : existingThread.unread_count}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.supportActionBtn, isCompact ? styles.supportActionBtnCompact : null]}>
          {isOpening ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Ionicons name="chatbubble-ellipses" size={isCompact ? 18 : 20} color={colors.onAccent} />
          )}
        </View>
      )}
    </AppPressable>
  );
}
