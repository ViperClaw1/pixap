import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import type { PostItem } from "@/shared/model/types/posts";
import { useMyFollowing } from "@/entities/user";
import { usePostsFeedRealtime } from "@/entities/post/lib/usePostsFeedRealtime";
import { compareFeedPosts, comparePostsByBoostThenCreated } from "../lib/compareFeedPosts";
import { useInteractedPlaceIds } from "./useInteractedPlaceIds";
import { REALTIME_POLL_MS } from "@/shared/realtime/realtimePolling";
import {
  collectBoostedAtFromAllFeedCaches,
  collectPostsFromFeedCache,
  mergeBoostedAtIntoFeedPage,
  mergeRefetchedFeedPageWithCache,
  type FeedPostsPage,
} from "../lib/postFeedCachePatch";
import { FEED_MAX_CACHED_PAGES } from "../model/feedConstants";
import { fetchPostsFeedPage, type FeedPostsCursor } from "./fetchPostsFeedPage";

export type { FeedPostsCursor, FeedPostsPage };

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

export type UsePostsFeedOptions = {
  /** When set, loads posts for this author from DB (profile posts tab). */
  authorUserId?: string;
};

function flattenFeedPages(pages: FeedPostsPage[] | undefined): FeedPostItem[] {
  const byId = new Map<string, FeedPostItem>();
  const order: string[] = [];
  for (const page of pages ?? []) {
    for (const post of page.posts) {
      if (!byId.has(post.id)) {
        order.push(post.id);
        byId.set(post.id, post);
      } else {
        byId.set(post.id, post);
      }
    }
  }
  return order.map((id) => byId.get(id)!);
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

      const page = await fetchPostsFeedPage(
        { cursor, authorUserId },
        { userId: user?.id, followingSet },
      );

      const merged = isFirstPage ? mergeRefetchedFeedPageWithCache(page, cachedPosts, { authorUserId }) : page;
      return mergeBoostedAtIntoFeedPage(merged, boostedAtByPostId, authorUserId);
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined),
  });

  const posts = useMemo(() => {
    const pages = query.data?.pages;
    if (!pages?.length) return [];
    if (pages.some((page) => page.viaLegacy)) {
      return dedupeAndSortFeedPosts(pages, { authorUserId, followingSet, interactedPlaceIds });
    }
    return flattenFeedPages(pages);
  }, [query.data?.pages, authorUserId, followingSet, interactedPlaceIds]);

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
