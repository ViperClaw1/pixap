import { supabase } from "@/shared/api/supabase/client";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";
import { parseMediaBlurhashesColumn } from "@/shared/lib/parseMediaBlurhashesColumn";
import type { PostProfile, PostReactionType } from "@/shared/model/types/posts";
import type { FeedPostItem } from "./usePostsFeed";
import { FEED_PAGE_SIZE } from "../model/feedConstants";
import { fetchPostsFeedPageLegacy, type LegacyFeedPostsCursor } from "./fetchPostsFeedPageLegacy";

export type FeedPostsCursor = {
  boostRank: number;
  boostedAt: string | null;
  createdAt: string;
  score?: number;
  id: string;
};

export type FeedPostsPage = {
  posts: FeedPostItem[];
  hasMore: boolean;
  nextCursor: FeedPostsCursor | null;
  /** Set when RPC failed and the legacy multi-query path was used. */
  viaLegacy?: boolean;
};

type RpcPostRow = {
  id: string;
  user_id: string;
  place_id: string | null;
  content: string;
  media_url: string | null;
  media_blurhashes?: unknown;
  created_at: string;
  boosted_at?: string | null;
  geo_place_name?: string | null;
  geo_formatted_address?: string | null;
  geo_latitude?: number | null;
  geo_longitude?: number | null;
  reaction_count: number;
  comment_count: number;
  my_reaction: PostReactionType | null;
  profile: PostProfile | null;
  place_name: string;
  business_card: { id: string; name: string; images: unknown } | null;
  comment_preview: Array<{ id: string; content: string; created_at: string; avatar_url: string | null }>;
  is_followed_author: boolean;
};

type RpcFeedResponse = {
  posts: RpcPostRow[];
  has_more: boolean;
  next_cursor: {
    boost_rank: number;
    boosted_at: string | null;
    created_at: string;
    score?: number;
    id: string;
  } | null;
};

function isMissingPostsFeedRpc(message?: string) {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("get_posts_feed_page") || lower.includes("could not find the function");
}

function shouldFallbackToLegacyRpc(error: { message?: string; code?: string }) {
  const msg = (error.message ?? "").toLowerCase();
  if (isMissingPostsFeedRpc(msg)) return true;
  if (error.code === "42703" || error.code === "42804") return true;
  return msg.includes("media_blurhashes") || msg.includes("cannot be matched") || msg.includes("coalesce");
}

function isRpcFeedPayload(value: unknown): value is RpcFeedResponse {
  if (!value || typeof value !== "object") return false;
  return "posts" in value && Array.isArray((value as RpcFeedResponse).posts);
}

function toLegacyCursor(cursor: FeedPostsCursor | null): LegacyFeedPostsCursor | null {
  if (!cursor) return null;
  if ("createdAt" in cursor && "id" in cursor && !("boostRank" in cursor)) {
    return cursor as LegacyFeedPostsCursor;
  }
  return { createdAt: cursor.createdAt, id: cursor.id };
}

function legacyCursorToFeed(cursor: LegacyFeedPostsCursor | null): FeedPostsCursor | null {
  if (!cursor) return null;
  return {
    boostRank: 0,
    boostedAt: null,
    createdAt: cursor.createdAt,
    id: cursor.id,
  };
}

function mapRpcPost(row: RpcPostRow): FeedPostItem {
  return {
    id: row.id,
    user_id: row.user_id,
    place_id: row.place_id,
    geo_place_name: row.geo_place_name ?? null,
    geo_formatted_address: row.geo_formatted_address ?? null,
    geo_latitude: row.geo_latitude ?? null,
    geo_longitude: row.geo_longitude ?? null,
    content: row.content,
    media_url: row.media_url,
    media_blurhashes: parseMediaBlurhashesColumn(row.media_blurhashes),
    created_at: row.created_at,
    boosted_at: row.boosted_at ?? null,
    reaction_count: row.reaction_count ?? 0,
    comment_count: row.comment_count ?? 0,
    my_reaction: row.my_reaction ?? null,
    profile: row.profile,
    place_name: row.place_name ?? "Place",
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

export type FetchPostsFeedPageContext = {
  userId?: string;
  followingSet: ReadonlySet<string>;
};

export async function fetchPostsFeedPage(
  params: {
    cursor: FeedPostsCursor | null;
    limit?: number;
    authorUserId?: string;
  },
  context?: FetchPostsFeedPageContext,
): Promise<FeedPostsPage> {
  const { cursor, limit = FEED_PAGE_SIZE, authorUserId } = params;

  const { data, error } = await supabase.rpc("get_posts_feed_page", {
    p_limit: limit,
    p_author_user_id: authorUserId ?? null,
    p_cursor_boost_rank: cursor?.boostRank ?? null,
    p_cursor_boosted_at: cursor?.boostedAt ?? null,
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_score: cursor?.score ?? null,
    p_cursor_id: cursor?.id ?? null,
  });

  if (error) {
    if (context && shouldFallbackToLegacyRpc(error)) {
      const legacy = await fetchPostsFeedPageLegacy({
        cursor: toLegacyCursor(cursor),
        limit,
        authorUserId,
        userId: context.userId,
        followingSet: context.followingSet,
      });
      return {
        posts: legacy.posts,
        hasMore: legacy.hasMore,
        nextCursor: legacyCursorToFeed(legacy.nextCursor),
        viaLegacy: true,
      };
    }
    throw error;
  }

  if (!isRpcFeedPayload(data)) {
    throw new Error("Unexpected get_posts_feed_page response shape");
  }

  const payload = data;
  const next = payload.next_cursor;

  return {
    posts: (payload.posts ?? []).map(mapRpcPost),
    hasMore: Boolean(payload.has_more),
    nextCursor: next
      ? {
          boostRank: next.boost_rank,
          boostedAt: next.boosted_at,
          createdAt: next.created_at,
          score: next.score,
          id: next.id,
        }
      : null,
  };
}
