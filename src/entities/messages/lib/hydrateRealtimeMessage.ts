import type { MessageBubble } from "../api/useThreadMessages";
import { resolveMessageMine, type SupportThreadMeta } from "./resolveMessageMine";

import { parseAttachmentBlurhashesColumn } from "./parseAttachmentBlurhashesColumn";

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  attachments: string[] | null;
  attachment_blurhashes?: unknown;
  created_at: string;
};

export function rowToMessageBubble(
  row: MessageRow,
  userId: string,
  threadMeta: SupportThreadMeta | null = null,
  viewerIsSupportStaff = false,
): MessageBubble {
  return {
    id: row.id,
    thread_id: row.thread_id,
    sender_id: row.sender_id,
    content: row.content,
    attachments: Array.isArray(row.attachments)
      ? row.attachments.filter((item): item is string => typeof item === "string")
      : [],
    attachment_blurhashes: parseAttachmentBlurhashesColumn(row.attachment_blurhashes),
    created_at: row.created_at,
    mine: resolveMessageMine({
      viewerId: userId,
      senderId: row.sender_id,
      threadMeta,
      viewerIsSupportStaff,
    }),
    sender_profile: null,
    reactions: [],
  };
}

export function parseRealtimeRow<T>(payload: { new?: T; old?: T }): T | null {
  return payload.new ?? payload.old ?? null;
}
