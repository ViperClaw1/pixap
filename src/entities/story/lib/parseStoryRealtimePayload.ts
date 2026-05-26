type RealtimePayload<T> = {
  new?: T;
  old?: T;
};

export function parseRealtimeRow<T extends { id?: string }>(payload: RealtimePayload<T>): T | null {
  const row = (payload.new?.id ? payload.new : payload.old) as T | undefined;
  if (!row?.id) return null;
  return row;
}

export type StoryRowPayload = {
  id: string;
  user_id: string;
  place_id: string | null;
  content: string;
  media_url: string | null;
  created_at: string;
};

export type StoryReactionRowPayload = {
  id: string;
  user_id: string;
  story_id: string | null;
  comment_id: string | null;
  reply_id: string | null;
  type: string;
};

export type StoryCommentRowPayload = {
  id: string;
  story_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
};

export function parseStoryRow(payload: RealtimePayload<StoryRowPayload>): StoryRowPayload | null {
  return parseRealtimeRow(payload);
}

export function parseStoryReactionRow(
  payload: RealtimePayload<StoryReactionRowPayload>,
): StoryReactionRowPayload | null {
  return parseRealtimeRow(payload);
}

export function parseStoryCommentRow(
  payload: RealtimePayload<StoryCommentRowPayload>,
): StoryCommentRowPayload | null {
  return parseRealtimeRow(payload);
}
