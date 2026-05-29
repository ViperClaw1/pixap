import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { useStoriesFeedRealtime } from "@/entities/story/lib/useStoriesFeedRealtime";
import { REALTIME_POLL_MS } from "@/shared/realtime/realtimePolling";
import {
  fetchStoriesFeedPage,
  type FeedStoriesCursor,
  type FeedStoryItem,
  type StoriesFeedPage,
} from "./fetchStoriesFeedPage";

export type { FeedStoryItem };

const FEED_MAX_CACHED_PAGES = 40;

export function useStoriesFeed() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const feedQueryKey = queryKeys.stories.feed(user?.id ?? null);
  const realtimeConnected = useStoriesFeedRealtime(user?.id ?? null);

  const query = useInfiniteQuery({
    queryKey: feedQueryKey,
    initialPageParam: null as FeedStoriesCursor | null,
    maxPages: FEED_MAX_CACHED_PAGES,
    staleTime: 45 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: realtimeConnected ? false : REALTIME_POLL_MS.storiesFeed,
    queryFn: async ({ pageParam }) => fetchStoriesFeedPage({ cursor: pageParam }),
    getNextPageParam: (lastPage: StoriesFeedPage) => (lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined),
  });

  const stories = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.stories),
    [query.data?.pages],
  );

  const resetFeed = useCallback(() => {
    void queryClient.resetQueries({ queryKey: feedQueryKey });
  }, [queryClient, feedQueryKey]);

  const loadMore = useCallback(() => {
    if (!query.hasNextPage || query.isFetchingNextPage) return;
    void query.fetchNextPage();
  }, [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage]);

  return {
    ...query,
    stories,
    hasMore: query.hasNextPage ?? false,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    loadMore,
    resetFeed,
  };
}

export type { FeedStoriesCursor, StoriesFeedPage };
