export type ContentReportTargetType =
  | "post"
  | "story"
  | "post_comment"
  | "story_comment"
  | "message"
  | "user"
  | "ai_response";

export type ContentReportReason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "nudity"
  | "violence"
  | "illegal"
  | "other";

export type ReportContentPayload = {
  targetType: ContentReportTargetType;
  targetId?: string | null;
  reportedUserId?: string | null;
  reason: ContentReportReason;
  details?: string;
};

export type ModerationSubject = {
  targetType: ContentReportTargetType;
  targetId?: string | null;
  reportedUserId: string;
  authorLabel?: string;
};
