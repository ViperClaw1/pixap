export type StoryReactionType = "like" | "dislike" | "sticker";

export interface StoryProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export interface StoryItem {
  id: string;
  user_id: string;
  place_id: string | null;
  content: string;
  media_url: string | null;
  /** BlurHash strings parallel to `media_url` entries (null slots = no hash). */
  media_blurhashes?: (string | null)[] | null;
  created_at: string;
  reaction_count: number;
  comment_count: number;
  my_reaction: StoryReactionType | null;
  profile: StoryProfile | null;
}

export interface StoryGroup {
  user_id: string;
  profile: StoryProfile | null;
  stories: StoryItem[];
}

export interface StoryViewerRouteParams {
  groups: StoryGroup[];
  initialGroupIndex: number;
  initialStoryIndex: number;
  placeId: string;
  /** When opening viewer from archive grid: story id → initial carousel slide index. */
  initialMediaByStoryId?: Record<string, number>;
}

export interface StoryComposerRouteParams {
  placeId: string;
}

export interface AddStoryFromPostRouteParams {
  postId: string;
  /** Null when the source post has no linked business_card (geo-only post). */
  placeId: string | null;
  postImages: string[];
}

export interface StoryDiscussionRouteParams {
  storyId: string;
  placeId: string | null;
}
