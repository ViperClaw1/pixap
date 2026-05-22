import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import type { PostItem } from "@/shared/model/types/posts";
import { useMyFollowing } from "@/entities/user";
import { usePostsFeedRealtime } from "@/entities/post/lib/usePostsFeedRealtime";
import {
  enrichPostsBoostedAt,
  hydrateFeedPosts,
  isMissingGeoColumnsError,
  isMissingMediaBlurhashesError,
  isMissingBoostedAtError,
  normalizePostRow,
  type PostRowInput,
} from "@/entities/post/lib/hydrateFeedPosts";
import { useInteractedPlaceIds } from "./useInteractedPlaceIds";
import { REALTIME_POLL_MS } from "@/shared/realtime/realtimePolling";
import { compareFeedPosts, comparePostsByBoostThenCreated } from "../lib/compareFeedPosts";
import {
  collectBoostedAtFromAllFeedCaches,
  collectPostsFromFeedCache,
  mergeBoostedAtIntoFeedPage,
  mergeRefetchedFeedPageWithCache,
  type FeedPostsPage,
} from "../lib/postFeedCachePatch";
import { FEED_MAX_CACHED_PAGES, FEED_PAGE_SIZE } from "../model/feedConstants";

export type FeedPostItem = PostItem & {
  place_name: string;
  business_card: {
    id: string;
    name: string;
    images: string[];
  } | null;
  comment_preview: Array<{ id: string; content: string; created_at: string; avatar_url: string | null }>;
  is_followed_author: boolean;
};

export type FeedPostsCursor = { createdAt: string; id: string };

export type UsePostsFeedOptions = {
  /** When set, loads posts for this author from DB (profile posts tab). */
  authorUserId?: string;
};

type FetchPostsFeedPageParams = {
  cursor: FeedPostsCursor | null;
  userId: string | undefined;
  followingSet: ReadonlySet<string>;
  interactedPlaceIds: string[];
  authorUserId?: string;
};

const postsSelectLegacy = "id, user_id, place_id, content, media_url, created_at";
const postsSelectWithGeo =
  "id, user_id, place_id, content, media_url, created_at, geo_place_name, geo_formatted_address, geo_latitude, geo_longitude";
const postsSelectWithGeoAndBlur = `${postsSelectWithGeo}, media_blurhashes`;
const postsSelectWithBoost = `${postsSelectWithGeoAndBlur}, boosted_at`;

function applyCreatedAtIdCursor<T extends { or: (filters: string) => T }>(
  query: T,
  cursor: FeedPostsCursor | null,
): T {
  if (!cursor) return query;
  return query.or(
    `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
  );
}

async function runPostsSelect(params: {
  select: string;
  cursor: FeedPostsCursor | null;
  limit: number;
  authorUserId?: string;
}): Promise<{ rows: PostRowInput[]; hasMore: boolean; nextCursor: FeedPostsCursor | null; selectIncludedBoostedAt: boolean }> {
  const { select, cursor, limit, authorUserId } = params;
  const fetchLimit = limit + 1;

  const exec = () => {
    let q = supabase.from("posts" as any).select(select);
    if (authorUserId) {
      q = q.eq("user_id", authorUserId);
    }
    q = applyCreatedAtIdCursor(q, cursor);
    return q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(fetchLimit);
  };

  let selectIncludedBoostedAt = select.includes("boosted_at");
  let postsQuery = await exec();
  if (postsQuery.error && isMissingBoostedAtError(postsQuery.error.message)) {
    selectIncludedBoostedAt = false;
    const fallbackSelect = select.includes("media_blurhashes")
      ? postsSelectWithGeoAndBlur
      : select.includes("geo_place_name")
        ? postsSelectWithGeo
        : postsSelectLegacy;
    postsQuery = await (() => {
      let q = supabase.from("posts" as any).select(fallbackSelect);
      if (authorUserId) q = q.eq("user_id", authorUserId);
      q = applyCreatedAtIdCursor(q, cursor);
      return q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(fetchLimit);
    })();
  }
  if (postsQuery.error && isMissingGeoColumnsError(postsQuery.error.message)) {
    selectIncludedBoostedAt = false;
    postsQuery = await (() => {
      let q = supabase.from("posts" as any).select(postsSelectLegacy);
      if (authorUserId) q = q.eq("user_id", authorUserId);
      q = applyCreatedAtIdCursor(q, cursor);
      return q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(fetchLimit);
    })();
  } else if (postsQuery.error && isMissingMediaBlurhashesError(postsQuery.error.message)) {
    selectIncludedBoostedAt = false;
    postsQuery = await (() => {
      let q = supabase.from("posts" as any).select(postsSelectWithGeo);
      if (authorUserId) q = q.eq("user_id", authorUserId);
      q = applyCreatedAtIdCursor(q, cursor);
      return q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(fetchLimit);
    })();
  }
  if (postsQuery.error) throw postsQuery.error;

  const rawRows = (postsQuery.data ?? []) as Array<Record<string, unknown>>;
  const hasMore = rawRows.length > limit;
  const pageRows = hasMore ? rawRows.slice(0, limit) : rawRows;
  let rows = pageRows.map((row) => normalizePostRow(row));
  if (!selectIncludedBoostedAt && rows.length) {
    rows = await enrichPostsBoostedAt(rows);
  }

  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last
      ? { createdAt: String(last.created_at ?? ""), id: String(last.id ?? "") }
      : null;

  return { rows, hasMore, nextCursor, selectIncludedBoostedAt };
}

async function fetchActiveBoostedRows(authorUserId?: string): Promise<PostRowInput[]> {
  const exec = (select: string) => {
    let q = supabase.from("posts" as any).select(select).not("boosted_at", "is", null);
    if (authorUserId) q = q.eq("user_id", authorUserId);
    return q.order("boosted_at", { ascending: false }).limit(40);
  };

  let result = await exec(postsSelectWithBoost);
  if (result.error && isMissingBoostedAtError(result.error.message)) {
    result = await exec(postsSelectWithGeoAndBlur);
  }
  if (result.error) return [];

  return ((result.data ?? []) as Array<Record<string, unknown>>).map((row) => normalizePostRow(row));
}

async function fetchPostsFeedPage(params: FetchPostsFeedPageParams): Promise<FeedPostsPage> {
  const { cursor, userId, followingSet, interactedPlaceIds, authorUserId } = params;

  const boostedRows = cursor ? [] : await fetchActiveBoostedRows(authorUserId);
  const { rows: chronRows, hasMore, nextCursor, selectIncludedBoostedAt } = await runPostsSelect({
    select: postsSelectWithBoost,
    cursor,
    limit: FEED_PAGE_SIZE,
    authorUserId,
  });

  const byId = new Map<string, PostRowInput>();
  for (const row of boostedRows) byId.set(row.id, row);
  for (const row of chronRows) byId.set(row.id, row);
  const mergedRows = [...byId.values()];
  if (!mergedRows.length) return { posts: [], hasMore: false, nextCursor: null };

  let postRows = mergedRows;
  if (!selectIncludedBoostedAt) {
    postRows = await enrichPostsBoostedAt(postRows);
  }

  const hydrated = await hydrateFeedPosts(postRows, { userId, followingSet });

  return {
    posts: hydrated,
    hasMore,
    nextCursor,
  };
}

function dedupeAndSortFeedPosts(
  pages: FeedPostsPage[] | undefined,
  options: {
    authorUserId?: string;
    followingSet: ReadonlySet<string>;
    interactedPlaceIds: string[];
  },
): FeedPostItem[] {
  const { authorUserId, followingSet, interactedPlaceIds } = options;
  const byId = new Map<string, FeedPostItem>();
  for (const page of pages ?? []) {
    for (const post of page.posts) {
      byId.set(post.id, post);
    }
  }
  const merged = [...byId.values()];

  if (authorUserId) {
    return merged.sort(comparePostsByBoostThenCreated);
  }

  const interactedPlaceSet = new Set(interactedPlaceIds);
  const scored = merged.map((post) => {
    const placeKey = post.place_id ?? "";
    const score = followingSet.has(post.user_id)
      ? 0
      : placeKey && interactedPlaceSet.has(placeKey)
        ? 1
        : 2;
    return { ...post, score };
  });
  scored.sort(compareFeedPosts);
  return scored.map(({ score: _score, ...post }) => post);
}

export function usePostsFeed(options: UsePostsFeedOptions = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { followingIds, followingSet } = useMyFollowing();
  const followingSignature = useMemo(() => [...followingIds].sort().join(","), [followingIds]);
  const { data: interactedPlaceIds = [] } = useInteractedPlaceIds(user?.id);
  const authorUserId = options.authorUserId?.trim() || undefined;

  const feedQueryKey = queryKeys.posts.feed(user?.id ?? null, followingSignature, authorUserId ?? null);
  const realtimeConnected = usePostsFeedRealtime(user?.id ?? null);

  const query = useInfiniteQuery({
    queryKey: feedQueryKey,
    initialPageParam: null as FeedPostsCursor | null,
    maxPages: FEED_MAX_CACHED_PAGES,
    staleTime: 45 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: realtimeConnected ? false : REALTIME_POLL_MS.postsFeed,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as FeedPostsCursor | null;
      const isFirstPage = !cursor;
      const boostedAtByPostId = isFirstPage ? collectBoostedAtFromAllFeedCaches(queryClient) : new Map<string, string>();
      const cachedPosts = isFirstPage ? collectPostsFromFeedCache(queryClient, feedQueryKey) : [];

      const page = await fetchPostsFeedPage({
        cursor,
        userId: user?.id,
        followingSet,
        interactedPlaceIds,
        authorUserId,
      });

      const merged = isFirstPage ? mergeRefetchedFeedPageWithCache(page, cachedPosts, { authorUserId }) : page;
      return mergeBoostedAtIntoFeedPage(merged, boostedAtByPostId, authorUserId);
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined),
  });

  const posts = useMemo(
    () =>
      dedupeAndSortFeedPosts(query.data?.pages, {
        authorUserId,
        followingSet,
        interactedPlaceIds,
      }),
    [query.data?.pages, authorUserId, followingSet, interactedPlaceIds],
  );

  const loadMore = useCallback(() => {
    if (!query.hasNextPage || query.isFetchingNextPage) return;
    void query.fetchNextPage();
  }, [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage]);

  const resetFeed = useCallback(() => {
    void queryClient.resetQueries({ queryKey: feedQueryKey });
  }, [queryClient, feedQueryKey]);

  return {
    ...query,
    posts,
    hasMore: query.hasNextPage ?? false,
    isFetchingNextPage: query.isFetchingNextPage,
    loadMore,
    resetFeed,
  };
}
