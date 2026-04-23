export type StoryReactionType = "like" | "dislike" | "sticker";

export interface StoryProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface StoryItem {
  id: string;
  user_id: string;
  place_id: string;
  content: string;
  media_url: string | null;
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
}

export interface StoryComposerRouteParams {
  placeId: string;
}

export interface StoryDiscussionRouteParams {
  storyId: string;
  placeId: string;
}
