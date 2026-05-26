import { supabase } from "@/shared/api/supabase/client";
import type { StoryItem, StoryProfile, StoryReactionType } from "@/shared/model/types/stories";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";
import { parseMediaBlurhashesColumn } from "@/shared/lib/parseMediaBlurhashesColumn";

export type FeedStoryItem = StoryItem & {
  place_name: string;
  business_card: {
    id: string;
    name: string;
    images: string[];
  } | null;
  comment_preview: Array<{ id: string; content: string; created_at: string }>;
  is_followed_author: boolean;
};

export type FeedStoriesCursor = {
  score: number;
  createdAt: string;
  id: string;
};

export type StoriesFeedPage = {
  stories: FeedStoryItem[];
  hasMore: boolean;
  nextCursor: FeedStoriesCursor | null;
};

const FEED_PAGE_SIZE = 12;

type RpcStoryRow = {
  id: string;
  user_id: string;
  place_id: string | null;
  content: string;
  media_url: string | null;
  media_blurhashes?: unknown;
  created_at: string;
  reaction_count: number;
  comment_count: number;
  my_reaction: StoryReactionType | null;
  profile: StoryProfile | null;
  place_name: string;
  business_card: { id: string; name: string; images: unknown } | null;
  comment_preview: Array<{ id: string; content: string; created_at: string }>;
  is_followed_author: boolean;
};

type RpcFeedResponse = {
  stories: RpcStoryRow[];
  has_more: boolean;
  next_cursor: { score: number; created_at: string; id: string } | null;
};

function isMissingStoriesFeedRpc(message?: string) {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("get_stories_feed_page") || lower.includes("could not find the function");
}

function mapRpcStory(row: RpcStoryRow): FeedStoryItem {
  return {
    id: row.id,
    user_id: row.user_id,
    place_id: row.place_id,
    content: row.content,
    media_url: row.media_url,
    media_blurhashes: parseMediaBlurhashesColumn(row.media_blurhashes),
    created_at: row.created_at,
    reaction_count: row.reaction_count ?? 0,
    comment_count: row.comment_count ?? 0,
    my_reaction: row.my_reaction ?? null,
    profile: row.profile,
    place_name: row.place_name ?? "Unknown place",
    business_card: row.business_card
      ? {
          id: row.business_card.id,
          name: row.business_card.name,
          images: normalizeBusinessCardImages(row.business_card.images),
        }
      : null,
    comment_preview: row.comment_preview ?? [],
    is_followed_author: Boolean(row.is_followed_author),
  };
}

export async function fetchStoriesFeedPage(params: {
  cursor: FeedStoriesCursor | null;
  limit?: number;
}): Promise<StoriesFeedPage> {
  const { cursor, limit = FEED_PAGE_SIZE } = params;

  const { data, error } = await supabase.rpc("get_stories_feed_page", {
    p_limit: limit,
    p_cursor_score: cursor?.score ?? null,
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
  });

  if (error) {
    if (isMissingStoriesFeedRpc(error.message)) {
      throw new Error(
        "Stories feed RPC is not deployed. Apply migration 20260610130000_stories_feed_rpc.sql.",
      );
    }
    throw error;
  }

  const payload = (data ?? { stories: [], has_more: false, next_cursor: null }) as RpcFeedResponse;
  const next = payload.next_cursor;

  return {
    stories: (payload.stories ?? []).map(mapRpcStory),
    hasMore: Boolean(payload.has_more),
    nextCursor: next
      ? {
          score: next.score,
          createdAt: next.created_at,
          id: next.id,
        }
      : null,
  };
}

export { FEED_PAGE_SIZE as STORIES_FEED_PAGE_SIZE };
