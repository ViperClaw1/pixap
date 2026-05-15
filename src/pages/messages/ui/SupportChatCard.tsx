import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { MessageThreadItem } from "@/shared/model/types/messages";

type SupportChatCardStyles = {
  supportCard: object;
  supportCardCompact: object;
  supportIconWrap: object;
  supportIconWrapCompact: object;
  supportMain: object;
  supportTitle: object;
  supportTitleCompact: object;
  supportSubtitle: object;
  supportSubtitleCompact: object;
  supportActionBtn: object;
  supportActionBtnCompact: object;
};

type Props = {
  styles: SupportChatCardStyles;
  colors: ThemeColors;
  isCompact: boolean;
  isOpening: boolean;
  existingThread: MessageThreadItem | null;
  onPress: () => void;
};

export function SupportChatCard({ styles, colors, isCompact, isOpening, existingThread, onPress }: Props) {
  const { t } = useTranslation();
  const subtitle =
    existingThread?.last_message_text?.trim() || t("messages.supportSubtitle");

  return (
    <Pressable
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
      <View style={[styles.supportActionBtn, isCompact ? styles.supportActionBtnCompact : null]}>
        {isOpening ? (
          <ActivityIndicator size="small" color={colors.onAccent} />
        ) : (
          <Ionicons name="chatbubble-ellipses" size={isCompact ? 18 : 20} color={colors.onAccent} />
        )}
      </View>
    </Pressable>
  );
}
