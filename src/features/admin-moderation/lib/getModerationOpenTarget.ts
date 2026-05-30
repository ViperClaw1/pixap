import type { AdminContentReport } from "@/entities/admin-moderation";

export type ModerationOpenTarget =
  | { kind: "post"; postId: string }
  | { kind: "story"; storyId: string }
  | { kind: "post_discussion"; postId: string }
  | { kind: "story_discussion"; storyId: string; placeId: string | null }
  | {
      kind: "message_thread";
      threadId: string;
      peerId: string;
      peerFirstName: string | null;
      peerLastName: string | null;
      peerUsername: string | null;
    };

export function getModerationOpenTarget(report: AdminContentReport): ModerationOpenTarget | null {
  const targetId = report.target_id?.trim() || null;
  const openId = report.open_content_id?.trim() || targetId;

  switch (report.target_type) {
    case "post":
      return openId ? { kind: "post", postId: openId } : null;
    case "story":
      return openId ? { kind: "story", storyId: openId } : null;
    case "post_comment":
      return openId ? { kind: "post_discussion", postId: openId } : null;
    case "story_comment":
      return openId
        ? {
            kind: "story_discussion",
            storyId: openId,
            placeId: report.story_place_id ?? null,
          }
        : null;
    case "message": {
      const threadId = report.message_thread_id?.trim();
      const peerId = report.reported_user_id?.trim();
      if (!threadId || !peerId) return null;
      return {
        kind: "message_thread",
        threadId,
        peerId,
        peerFirstName: report.reported_first_name || null,
        peerLastName: report.reported_last_name || null,
        peerUsername: report.reported_username ?? null,
      };
    }
    default:
      return null;
  }
}

export function canOpenModerationContent(report: AdminContentReport): boolean {
  return getModerationOpenTarget(report) !== null;
}
