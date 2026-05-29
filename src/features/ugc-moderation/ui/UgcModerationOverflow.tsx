import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { AppPopupModal, appAlert } from "@/shared/ui/app-popup";
import { useBlockUser, useReportContent } from "../model/useModerationActions";
import type { ContentReportReason, ModerationSubject } from "../types/moderation";

type Props = {
  subject: ModerationSubject;
  /** Hide when viewing own content */
  hidden?: boolean;
  iconSize?: number;
  hitSlop?: number;
  /** Hide block action (e.g. AI responses) */
  reportOnly?: boolean;
};

const REPORT_REASONS: ContentReportReason[] = [
  "spam",
  "harassment",
  "hate_speech",
  "nudity",
  "violence",
  "illegal",
  "other",
];

export function UgcModerationOverflow({ subject, hidden = false, iconSize = 20, hitSlop = 8, reportOnly = false }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reportMutation = useReportContent();
  const blockMutation = useBlockUser();

  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [blockVisible, setBlockVisible] = useState(false);

  const authorLabel = subject.authorLabel?.trim() || t("common.unknownUser");

  const menuOptions = useMemo(
    () =>
      reportOnly
        ? [{ key: "report" as const, label: t("moderation.report") }]
        : [
            { key: "report" as const, label: t("moderation.report") },
            { key: "block" as const, label: t("moderation.blockUser") },
          ],
    [reportOnly, t],
  );

  const onMenuPick = useCallback(
    (key: "report" | "block") => {
      setMenuVisible(false);
      if (key === "report") {
        setReportVisible(true);
        return;
      }
      setBlockVisible(true);
    },
    [],
  );

  const submitReport = useCallback(
    async (reason: ContentReportReason) => {
      try {
        await reportMutation.mutateAsync({
          targetType: subject.targetType,
          targetId: subject.targetId ?? null,
          reportedUserId: subject.reportedUserId,
          reason,
        });
        setReportVisible(false);
        void appAlert(t("moderation.reportSubmittedTitle"), t("moderation.reportSubmittedMessage"));
      } catch (error) {
        void appAlert(t("common.unknownError"), error instanceof Error ? error.message : t("common.unknownError"));
      }
    },
    [reportMutation, subject, t],
  );

  const confirmBlock = useCallback(async () => {
    try {
      await blockMutation.mutateAsync(subject.reportedUserId);
      setBlockVisible(false);
      void appAlert(t("moderation.blockedTitle"), t("moderation.blockedMessage", { name: authorLabel }));
    } catch (error) {
      void appAlert(t("common.unknownError"), error instanceof Error ? error.message : t("common.unknownError"));
    }
  }, [authorLabel, blockMutation, subject.reportedUserId, t]);

  if (hidden) return null;

  return (
    <>
      <Pressable
        style={styles.trigger}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={t("moderation.moreActions")}
        onPress={() => setMenuVisible(true)}
      >
        <Ionicons name="ellipsis-horizontal" size={iconSize} color={colors.textMuted} />
      </Pressable>

      <BottomSheetPickerModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title={t("moderation.actionsTitle")}
        fitContent
        bodyScrollEnabled={false}
      >
        {menuOptions.map((option) => (
          <Pressable
            key={option.key}
            style={[styles.menuRow, { borderBottomColor: colors.border }]}
            onPress={() => onMenuPick(option.key)}
          >
            <Text style={[styles.menuRowText, { color: option.key === "block" ? colors.danger : colors.text }]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </BottomSheetPickerModal>

      <BottomSheetPickerModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        title={t("moderation.reportTitle")}
        fitContent
      >
        <Text style={[styles.reportHint, { color: colors.textMuted }]}>{t("moderation.reportHint")}</Text>
        {REPORT_REASONS.map((reason) => (
          <Pressable
            key={reason}
            style={[styles.menuRow, { borderBottomColor: colors.border }]}
            disabled={reportMutation.isPending}
            onPress={() => void submitReport(reason)}
          >
            <Text style={[styles.menuRowText, { color: colors.text }]}>{t(`moderation.reasons.${reason}`)}</Text>
          </Pressable>
        ))}
      </BottomSheetPickerModal>

      <Modal visible={blockVisible} transparent animationType="fade" onRequestClose={() => setBlockVisible(false)}>
        <AppPopupModal
          embedded
          visible={blockVisible}
          variant="alert"
          title={t("moderation.blockConfirmTitle", { name: authorLabel })}
          message={t("moderation.blockConfirmMessage")}
          loading={blockMutation.isPending}
          onClose={() => setBlockVisible(false)}
          buttons={[
            { text: t("common.cancel"), style: "cancel" },
            { text: t("moderation.blockUser"), style: "destructive", onPress: () => void confirmBlock(), skipCloseOnPress: true },
          ]}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  menuRow: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuRowText: {
    fontSize: 16,
    fontWeight: "500",
  },
  reportHint: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
});
