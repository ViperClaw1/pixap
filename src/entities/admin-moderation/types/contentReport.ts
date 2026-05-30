export type ContentReportStatus = "pending" | "reviewed" | "dismissed" | "action_taken";

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

export type AdminContentReport = {
  id: string;
  reporter_id: string;
  reporter_first_name: string;
  reporter_last_name: string;
  reporter_username: string | null;
  target_type: ContentReportTargetType;
  target_id: string | null;
  reported_user_id: string | null;
  reported_first_name: string;
  reported_last_name: string;
  reported_username: string | null;
  reason: ContentReportReason;
  details: string | null;
  status: ContentReportStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  /** Post/story id to open (resolved for comments). */
  open_content_id: string | null;
  message_thread_id: string | null;
  story_place_id: string | null;
};

export type AdminContentReportsPage = {
  reports: AdminContentReport[];
  pending_count: number;
};

export type AdminReportStatusFilter = ContentReportStatus | "all";
