export type PostReactionType = "like" | "dislike" | "sticker";

export interface PostProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  username: string | null;
  is_verified?: boolean;
}

export interface PostItem {
  id: string;
  user_id: string;
  place_id: string | null;
  geo_place_name?: string | null;
  geo_formatted_address?: string | null;
  geo_latitude?: number | null;
  geo_longitude?: number | null;
  content: string;
  media_url: string | null;
  /** BlurHash strings parallel to URLs in `media_url` when stored as JSON array (null slots = no hash). */
  media_blurhashes?: (string | null)[] | null;
  created_at: string;
  /** Set when author boosts the post in the discovery feed. */
  boosted_at?: string | null;
  reaction_count: number;
  comment_count: number;
  my_reaction: PostReactionType | null;
  profile: PostProfile | null;
}
