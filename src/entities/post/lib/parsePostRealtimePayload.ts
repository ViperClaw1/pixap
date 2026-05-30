type RealtimePayload<T> = {
  new?: T;
  old?: T;
};

export function parseRealtimeRow<T extends { id?: string }>(payload: RealtimePayload<T>): T | null {
  const row = (payload.new?.id ? payload.new : payload.old) as T | undefined;
  if (!row?.id) return null;
  return row;
}

export type PostReactionRowPayload = {
  id: string;
  user_id: string;
  post_id: string | null;
  type: string;
};

export function parsePostReactionRow(
  payload: RealtimePayload<PostReactionRowPayload>,
): PostReactionRowPayload | null {
  const row = parseRealtimeRow(payload);
  if (!row?.post_id) return null;
  return row;
}
