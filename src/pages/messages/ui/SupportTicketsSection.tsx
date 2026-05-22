import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { MessageThreadItem } from "@/shared/model/types/messages";
import { SupportTicketCard } from "./SupportTicketCard";
import type { useMessagesStyles } from "./messagesStyles";

type MessagesStyles = ReturnType<typeof useMessagesStyles>;

type Props = {
  styles: MessagesStyles;
  colors: ThemeColors;
  isCompact: boolean;
  tickets: MessageThreadItem[];
  typingThreadIds: ReadonlySet<string>;
  typingLabel: string;
  onOpenTicket: (thread: MessageThreadItem) => void;
  onPrefetchTicket: (threadId: string) => void;
};

export function SupportTicketsSection({
  styles,
  colors,
  isCompact,
  tickets,
  typingThreadIds,
  typingLabel,
  onOpenTicket,
  onPrefetchTicket,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.supportSection}>
      <View style={styles.supportSectionHeader}>
        <View style={[styles.supportSectionIconWrap, { backgroundColor: colors.accent }]}>
          <Ionicons name="headset-outline" size={isCompact ? 18 : 20} color={colors.onAccent} />
        </View>
        <Text style={[styles.supportSectionTitle, { color: colors.text }]}>{t("messages.mySupportTickets")}</Text>
      </View>
      {tickets.length ? (
        tickets.map((thread) => (
          <SupportTicketCard
            key={thread.thread_id}
            thread={thread}
            styles={styles}
            colors={colors}
            isCompact={isCompact}
            peerIsTyping={typingThreadIds.has(thread.thread_id)}
            typingLabel={typingLabel}
            onPress={() => onOpenTicket(thread)}
            onPressIn={() => onPrefetchTicket(thread.thread_id)}
          />
        ))
      ) : (
        <Text style={[styles.supportSectionEmpty, { color: colors.textMuted }]}>{t("messages.noSupportTickets")}</Text>
      )}
    </View>
  );
}
