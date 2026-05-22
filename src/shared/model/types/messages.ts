export interface MessageParticipantProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export interface MessageThreadItem {
  thread_id: string;
  last_message_id: string;
  last_message_text: string;
  last_message_at: string;
  last_sender_id: string;
  last_sender_name: string;
  last_sender_avatar_url: string | null;
  unread_count: number;
  participants: MessageParticipantProfile[];
  is_support?: boolean;
  /** End-user owner for `kind = support` threads (from inbox RPC). */
  support_user_id?: string | null;
  /** `profiles.account_role` of `support_user_id` when known. */
  support_user_account_role?: "user" | "admin" | null;
  /** Row title in the messages inbox list. */
  inbox_title?: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  attachments: string[];
  created_at: string;
}
