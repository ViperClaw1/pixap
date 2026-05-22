/** Typed realtime domain events (postgres_changes / broadcast demux). */

export type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  attachments: string[] | null;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  text: string;
  business_card_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type PostRow = {
  id: string;
  user_id: string;
  place_id: string | null;
  content: string;
  media_url: string | null;
  created_at: string;
};

export type AiGenerationJobRow = {
  id: string;
  user_id: string;
  kind: string;
  status: string;
  progress: number;
  result: unknown;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type RealtimeEvent =
  | { type: "message.created"; threadId: string; message: MessageRow }
  | { type: "message.updated"; threadId: string; message: MessageRow }
  | { type: "message.deleted"; threadId: string; messageId: string }
  | { type: "notification.created"; notification: NotificationRow }
  | { type: "notification.read"; notificationId: string; isRead: boolean }
  | { type: "post.created"; post: PostRow }
  | { type: "post.updated"; post: PostRow }
  | { type: "post.deleted"; postId: string }
  | { type: "engagement.updated"; postId?: string; storyId?: string }
  | { type: "generation.started"; jobId: string; kind: string }
  | { type: "generation.progress"; jobId: string; progress: number }
  | { type: "generation.completed"; jobId: string; result: unknown }
  | { type: "generation.failed"; jobId: string; error: string };
