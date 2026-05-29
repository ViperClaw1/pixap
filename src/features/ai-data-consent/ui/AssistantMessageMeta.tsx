import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { UgcModerationOverflow } from "@/features/ugc-moderation";

type Props = {
  messageId: string;
};

export function AssistantMessageMeta({ messageId }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.badge, { color: colors.textMuted, backgroundColor: colors.surface }]}>
        {t("aiConsent.aiGeneratedBadge")}
      </Text>
      <UgcModerationOverflow
        reportOnly
        subject={{
          targetType: "ai_response",
          targetId: messageId,
          reportedUserId: messageId,
          authorLabel: "PixAI",
        }}
        iconSize={14}
        hitSlop={6}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
});
