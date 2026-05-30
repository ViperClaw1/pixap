import { memo, useCallback } from "react";
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { AdminContentReport, ContentReportStatus } from "@/entities/admin-moderation";
import { formatReportPartyName } from "@/entities/admin-moderation";

type Props = {
  report: AdminContentReport;
  isUpdating: boolean;
  onDismiss: (reportId: string) => void;
  onMarkReviewed: (reportId: string) => void;
  onActionTaken: (reportId: string) => void;
  onOpenReportedUser?: (userId: string) => void;
  onOpenContent?: (report: AdminContentReport) => void;
  canOpenContent?: boolean;
};

function ModerationReportCardComponent({
  report,
  isUpdating,
  onDismiss,
  onMarkReviewed,
  onActionTaken,
  onOpenReportedUser,
  onOpenContent,
  canOpenContent = false,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const reporterName = formatReportPartyName(
    report.reporter_first_name,
    report.reporter_last_name,
    report.reporter_username,
    t("common.unknownUser"),
  );
  const reportedName = formatReportPartyName(
    report.reported_first_name,
    report.reported_last_name,
    report.reported_username,
    t("common.unknownUser"),
  );

  const statusColor = statusAccent(report.status, colors);

  const createdLabel = new Date(report.created_at).toLocaleString();

  const isPending = report.status === "pending";

  const handleOpenUser = useCallback(() => {
    if (report.reported_user_id && onOpenReportedUser) {
      onOpenReportedUser(report.reported_user_id);
    }
  }, [onOpenReportedUser, report.reported_user_id]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusText, { color: statusColor.text }]}>
            {t(`adminModeration.status.${report.status}`)}
          </Text>
        </View>
        <Text style={[styles.date, { color: colors.textMuted }]}>{createdLabel}</Text>
      </View>

      <Text style={[styles.reason, { color: colors.text }]}>
        {t(`moderation.reasons.${report.reason}`)}
      </Text>

      <View style={styles.targetRow}>
        <Text style={[styles.meta, styles.targetMeta, { color: colors.textMuted }]}>
          {t("adminModeration.targetType", { type: t(`adminModeration.targetTypes.${report.target_type}`) })}
          {report.target_id ? ` · ${report.target_id.slice(0, 8)}…` : ""}
        </Text>
        {canOpenContent && onOpenContent ? (
          <Pressable
            style={[styles.openContentBtn, { borderColor: colors.primary }]}
            onPress={() => onOpenContent(report)}
          >
            <Text style={[styles.openContentText, { color: colors.primary }]}>
              {t("adminModeration.openContent")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.meta, { color: colors.text }]}>
        {t("adminModeration.reporter", { name: reporterName })}
      </Text>

      {report.reported_user_id ? (
        <Pressable onPress={handleOpenUser} disabled={!onOpenReportedUser}>
          <Text style={[styles.meta, { color: colors.primary }]}>
            {t("adminModeration.reportedUser", { name: reportedName })}
          </Text>
        </Pressable>
      ) : null}

      {report.details?.trim() ? (
        <Text style={[styles.details, { color: colors.textMuted }]} numberOfLines={4}>
          {report.details.trim()}
        </Text>
      ) : null}

      {isPending ? (
        <View style={styles.actions}>
          {isUpdating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Pressable
                style={[styles.actionBtn, { borderColor: colors.border }]}
                onPress={() => onDismiss(report.id)}
              >
                <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>
                  {t("adminModeration.actions.dismiss")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { borderColor: colors.border }]}
                onPress={() => onMarkReviewed(report.id)}
              >
                <Text style={[styles.actionBtnText, { color: colors.text }]}>
                  {t("adminModeration.actions.reviewed")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => onActionTaken(report.id)}
              >
                <Text style={[styles.actionBtnText, { color: colors.onPrimary }]}>
                  {t("adminModeration.actions.actionTaken")}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      ) : report.reviewed_at ? (
        <Text style={[styles.resolvedAt, { color: colors.textMuted }]}>
          {t("adminModeration.resolvedAt", {
            date: new Date(report.reviewed_at).toLocaleString(),
          })}
        </Text>
      ) : null}
    </View>
  );
}

function statusAccent(
  status: ContentReportStatus,
  colors: { primary: string; textMuted: string; danger: string; accentSurface: string },
) {
  switch (status) {
    case "pending":
      return { bg: colors.accentSurface, text: colors.primary };
    case "action_taken":
      return { bg: "#dcfce7", text: "#166534" };
    case "dismissed":
      return { bg: colors.accentSurface, text: colors.textMuted };
    default:
      return { bg: colors.accentSurface, text: colors.primary };
  }
}

export const ModerationReportCard = memo(ModerationReportCardComponent);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  date: {
    fontSize: 11,
    flexShrink: 1,
  },
  reason: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  targetMeta: {
    flex: 1,
    minWidth: 120,
  },
  openContentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  openContentText: {
    fontSize: 12,
    fontWeight: "700",
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  details: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    alignItems: "center",
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  resolvedAt: {
    fontSize: 12,
    marginTop: 6,
  },
});
