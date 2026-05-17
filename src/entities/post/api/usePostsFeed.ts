import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import type { PostItem } from "@/shared/model/types/posts";
import { useMyFollowing } from "@/entities/user";
import { usePostsFeedRealtime } from "@/entities/post/lib/usePostsFeedRealtime";
import {
  hydrateFeedPosts,
  isMissingGeoColumnsError,
  isMissingMediaBlurhashesError,
  normalizePostRow,
} from "@/entities/post/lib/hydrateFeedPosts";

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

type FeedPage = { posts: FeedPostItem[]; hasMore: boolean; page: number };

const FEED_PAGE_SIZE = 12;
const FETCH_WINDOW_MULTIPLIER = 4;

async function getInteractedPlaceIds(userId: string): Promise<string[]> {
  const [ownPostsResult, ownReactionsResult, ownCommentsResult] = await Promise.all([
    supabase.from("posts" as any).select("place_id").eq("user_id", userId).limit(300),
    supabase.from("post_reactions" as any).select("post_id").eq("user_id", userId).not("post_id", "is", null).limit(500),
    supabase.from("post_comments" as any).select("post_id").eq("user_id", userId).limit(500),
  ]);

  const ownPostPlaces = ((ownPostsResult.data ?? []) as Array<{ place_id: string | null }>)
    .map((row) => row.place_id)
    .filter((id): id is string => Boolean(id));
  const relatedPostIds = Array.from(
    new Set(
      [
        ...((ownReactionsResult.data ?? []) as Array<{ post_id: string | null }>).map((row) => row.post_id),
        ...((ownCommentsResult.data ?? []) as Array<{ post_id: string }>).map((row) => row.post_id),
      ].filter(Boolean) as string[],
    ),
  );

  if (!relatedPostIds.length) return Array.from(new Set(ownPostPlaces));

  const { data: relatedPosts } = await supabase.from("posts" as any).select("id, place_id").in("id", relatedPostIds);
  const placeIds = new Set(ownPostPlaces);
  for (const row of (relatedPosts ?? []) as Array<{ place_id: string | null }>) {
    if (row.place_id) placeIds.add(row.place_id);
  }
  return Array.from(placeIds);
}

async function fetchPostsFeedPage(params: {
  page: number;
  userId: string | undefined;
  followingSet: ReadonlySet<string>;
}): Promise<FeedPage> {
  const { page, userId, followingSet } = params;
  const fetchLimit = page * FEED_PAGE_SIZE * FETCH_WINDOW_MULTIPLIER;
  const interactedPlaceIds = userId ? await getInteractedPlaceIds(userId) : [];

  const postsSelectLegacy = "id, user_id, place_id, content, media_url, created_at";
  const postsSelectWithGeo =
    "id, user_id, place_id, content, media_url, created_at, geo_place_name, geo_formatted_address, geo_latitude, geo_longitude";
  const postsSelectWithGeoAndBlur = `${postsSelectWithGeo}, media_blurhashes`;

  let postsQuery = await supabase
    .from("posts" as any)
    .select(postsSelectWithGeoAndBlur)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);
  if (postsQuery.error && isMissingGeoColumnsError(postsQuery.error.message)) {
    postsQuery = await supabase
      .from("posts" as any)
      .select(postsSelectLegacy)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);
  } else if (postsQuery.error && isMissingMediaBlurhashesError(postsQuery.error.message)) {
    postsQuery = await supabase
      .from("posts" as any)
      .select(postsSelectWithGeo)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);
  }
  if (postsQuery.error) throw postsQuery.error;

  const postRows = ((postsQuery.data ?? []) as Array<Record<string, unknown>>).map((row) => normalizePostRow(row));
  if (!postRows.length) return { posts: [], hasMore: false, page };

  const hydrated = await hydrateFeedPosts(postRows, { userId, followingSet });
  const interactedPlaceSet = new Set(interactedPlaceIds);
  const scored = hydrated.map((post) => {
    const placeKey = post.place_id ?? "";
    const score = followingSet.has(post.user_id)
      ? 0
      : placeKey && interactedPlaceSet.has(placeKey)
        ? 1
        : 2;
    return { ...post, score };
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const itemCount = page * FEED_PAGE_SIZE;
  return {
    posts: scored.slice(0, itemCount).map(({ score: _score, ...post }) => post),
    hasMore: postRows.length >= fetchLimit,
    page,
  };
}

export function usePostsFeed() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { followingIds, followingSet } = useMyFollowing();
  const followingSignature = useMemo(() => [...followingIds].sort().join(","), [followingIds]);

  const feedQueryKey = queryKeys.posts.feed(user?.id ?? null, followingSignature);
  const realtimeConnected = usePostsFeedRealtime(user?.id ?? null);

  const query = useInfiniteQuery({
    queryKey: feedQueryKey,
    initialPageParam: 1,
    maxPages: 1,
    staleTime: 45 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: realtimeConnected ? false : 25_000,
    queryFn: async ({ pageParam }) =>
      fetchPostsFeedPage({
        page: pageParam,
        userId: user?.id,
        followingSet,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });

  const lastPage = query.data?.pages[query.data.pages.length - 1];

  const resetFeed = useCallback(() => {
    void queryClient.resetQueries({ queryKey: feedQueryKey });
  }, [queryClient, feedQueryKey]);

  return {
    ...query,
    posts: lastPage?.posts ?? [],
    hasMore: lastPage?.hasMore ?? false,
    loadMore: () => void query.fetchNextPage(),
    resetFeed,
  };
}
