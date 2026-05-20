import type { MessageBubble } from "../api/useThreadMessages";

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  attachments: string[] | null;
  created_at: string;
};

export function rowToMessageBubble(row: MessageRow, userId: string): MessageBubble {
  return {
    id: row.id,
    thread_id: row.thread_id,
    sender_id: row.sender_id,
    content: row.content,
    attachments: Array.isArray(row.attachments)
      ? row.attachments.filter((item): item is string => typeof item === "string")
      : [],
    created_at: row.created_at,
    mine: row.sender_id === userId,
    sender_profile: null,
    reactions: [],
  };
}

export function parseRealtimeRow<T>(payload: { new?: T; old?: T }): T | null {
  return payload.new ?? payload.old ?? null;
}
