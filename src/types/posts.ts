export type PostReactionType = "like" | "dislike" | "sticker";

export interface PostProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface PostItem {
  id: string;
  user_id: string;
  place_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
  reaction_count: number;
  comment_count: number;
  my_reaction: PostReactionType | null;
  profile: PostProfile | null;
}
