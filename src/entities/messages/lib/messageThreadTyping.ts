export const MESSAGE_THREAD_TYPING_EVENT = "typing";

export type MessageThreadTypingPayload = {
  user_id: string;
  is_typing: boolean;
};

export const PEER_TYPING_IDLE_MS = 3_500;
export const TYPING_BROADCAST_THROTTLE_MS = 2_000;
