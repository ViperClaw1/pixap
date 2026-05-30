import type { TFunction } from "i18next";
import type { ContentReportReason } from "@/features/ugc-moderation";

export type MessageReportLabels = {
  title: string;
  hint: string;
  submittedTitle: string;
  submittedMessage: string;
  unknownError: string;
  reasonLabels: Record<ContentReportReason, string>;
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

export function buildMessageReportLabels(t: TFunction): MessageReportLabels {
  const reasonLabels = {} as Record<ContentReportReason, string>;
  for (const reason of REPORT_REASONS) {
    reasonLabels[reason] = t(`moderation.reasons.${reason}`);
  }
  return {
    title: t("moderation.reportTitle"),
    hint: t("moderation.reportHint"),
    submittedTitle: t("moderation.reportSubmittedTitle"),
    submittedMessage: t("moderation.reportSubmittedMessage"),
    unknownError: t("common.unknownError"),
    reasonLabels,
  };
}

export const MESSAGE_REPORT_REASONS = REPORT_REASONS;
