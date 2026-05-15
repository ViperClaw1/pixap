import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import type { StoryItem, StoryProfile, StoryReactionType } from "@/shared/model/types/stories";
import { useMyFollowing } from "@/entities/user";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";
import { parseMediaBlurhashesColumn } from "@/shared/lib/parseMediaBlurhashesColumn";

type StoryRow = {
  id: string;
  user_id: string;
  place_id: string | null;
  content: string;
  media_url: string | null;
  media_blurhashes?: unknown;
  created_at: string;
  expiry_time: string;
};

type PlaceRow = {
  id: string;
  name: string;
  images: unknown;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  username: string | null;
};

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

type FeedPage = { stories: FeedStoryItem[]; hasMore: boolean; page: number };

const FEED_PAGE_SIZE = 12;
const FETCH_WINDOW_MULTIPLIER = 4;

function isMissingMediaBlurhashesError(message?: string) {
  return (message ?? "").toLowerCase().includes("media_blurhashes");
}

async function getInteractedPlaceIds(userId: string): Promise<string[]> {
  const [ownStoriesResult, ownReactionsResult, ownCommentsResult] = await Promise.all([
    supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
      .from("stories" as any)
      .select("place_id")
      .eq("user_id", userId)
      .limit(300),
    supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
      .from("story_reactions" as any)
      .select("story_id")
      .eq("user_id", userId)
      .not("story_id", "is", null)
      .limit(500),
    supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
      .from("story_comments" as any)
      .select("story_id")
      .eq("user_id", userId)
      .limit(500),
  ]);

  const ownStoryPlaces = ((ownStoriesResult.data ?? []) as unknown as Array<{ place_id: string | null }>)
    .map((row) => row.place_id)
    .filter((id): id is string => Boolean(id));
  const relatedStoryIds = Array.from(
    new Set(
      [
        ...((ownReactionsResult.data ?? []) as unknown as Array<{ story_id: string | null }>).map(
          (row) => row.story_id,
        ),
        ...((ownCommentsResult.data ?? []) as unknown as Array<{ story_id: string }>).map((row) => row.story_id),
      ].filter(Boolean) as string[],
    ),
  );

  if (!relatedStoryIds.length) return Array.from(new Set(ownStoryPlaces));

  const { data: relatedStories } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
    .from("stories" as any)
    .select("id, place_id")
    .in("id", relatedStoryIds);

  const placeIds = new Set(ownStoryPlaces);
  for (const row of (relatedStories ?? []) as unknown as Array<{ place_id: string | null }>) {
    if (row.place_id) placeIds.add(row.place_id);
  }
  return Array.from(placeIds);
}

async function fetchStoriesFeedPage(params: {
  page: number;
  userId: string | undefined;
  followingSet: ReadonlySet<string>;
}): Promise<FeedPage> {
  const { page, userId, followingSet } = params;
  const fetchLimit = page * FEED_PAGE_SIZE * FETCH_WINDOW_MULTIPLIER;
  const interactedPlaceIds = userId ? await getInteractedPlaceIds(userId) : [];

  const storiesSelectWithBlur =
    "id, user_id, place_id, content, media_url, created_at, expiry_time, media_blurhashes";
  const storiesSelectLegacy = "id, user_id, place_id, content, media_url, created_at, expiry_time";

  let storiesQuery = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
    .from("stories" as any)
    .select(storiesSelectWithBlur)
    .gt("expiry_time", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(fetchLimit);
  if (storiesQuery.error && isMissingMediaBlurhashesError(storiesQuery.error.message)) {
    storiesQuery = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
      .from("stories" as any)
      .select(storiesSelectLegacy)
      .gt("expiry_time", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(fetchLimit);
  }
  if (storiesQuery.error) throw storiesQuery.error;

  const stories = (storiesQuery.data ?? []) as unknown as StoryRow[];
  if (!stories.length) return { stories: [], hasMore: false, page };

  const storyIds = stories.map((row) => row.id);
  const placeIds = Array.from(new Set(stories.map((row) => row.place_id).filter((id): id is string => Boolean(id))));
  const userIds = Array.from(new Set(stories.map((row) => row.user_id)));

  const [{ data: placesData }, { data: profilesData }, { data: commentsData }, { data: reactionsData }, myReactionsResult] =
    await Promise.all([
      placeIds.length
        ? supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
            .from("business_cards" as any)
            .select("id, name, images")
            .in("id", placeIds)
        : Promise.resolve({ data: [] as unknown[] }),
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url, username")
        .in("id", userIds),
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
        .from("story_comments" as any)
        .select("id, story_id, parent_id, content, created_at")
        .in("story_id", storyIds)
        .order("created_at", { ascending: false }),
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
        .from("story_reactions" as any)
        .select("story_id, type")
        .in("story_id", storyIds),
      userId
        ? supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
            .from("story_reactions" as any)
            .select("story_id, type")
            .eq("user_id", userId)
            .in("story_id", storyIds)
        : Promise.resolve({ data: [] }),
    ]);

  const places = new Map<string, PlaceRow>(((placesData ?? []) as unknown as PlaceRow[]).map((row) => [row.id, row]));
  const profiles = new Map<string, StoryProfile>(
    ((profilesData ?? []) as unknown as ProfileRow[]).map((row) => [
      row.id,
      {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        avatar_url: row.avatar_url,
        username: row.username,
      },
    ]),
  );

  const commentsByStory = new Map<string, Array<{ id: string; content: string; created_at: string }>>();
  const commentCountByStory = new Map<string, number>();
  for (const row of (commentsData ?? []) as unknown as Array<{
    id: string;
    story_id: string;
    parent_id: string | null;
    content: string;
    created_at: string;
  }>) {
    if (row.parent_id) continue;
    commentCountByStory.set(row.story_id, (commentCountByStory.get(row.story_id) ?? 0) + 1);
    if (!commentsByStory.has(row.story_id)) commentsByStory.set(row.story_id, []);
    const existing = commentsByStory.get(row.story_id)!;
    if (existing.length < 2) existing.push({ id: row.id, content: row.content, created_at: row.created_at });
  }

  const reactionCountByStory = new Map<string, number>();
  for (const row of (reactionsData ?? []) as unknown as Array<{ story_id: string; type: StoryReactionType }>) {
    if (row.type !== "like") continue;
    reactionCountByStory.set(row.story_id, (reactionCountByStory.get(row.story_id) ?? 0) + 1);
  }

  const myReactionByStory = new Map<string, StoryReactionType>();
  for (const row of ((myReactionsResult as { data?: Array<{ story_id: string; type: StoryReactionType }> }).data ??
    []) as Array<{ story_id: string; type: StoryReactionType }>) {
    myReactionByStory.set(row.story_id, row.type);
  }

  const interactedPlaceSet = new Set(interactedPlaceIds);
  const scored = stories.map((row) => {
    const score = followingSet.has(row.user_id) ? 0 : row.place_id && interactedPlaceSet.has(row.place_id) ? 1 : 2;
    const placeCard = row.place_id ? places.get(row.place_id) : undefined;
    return {
      id: row.id,
      user_id: row.user_id,
      place_id: row.place_id,
      place_name: placeCard?.name ?? "Unknown place",
      business_card: placeCard
        ? {
            id: placeCard.id,
            name: placeCard.name,
            images: normalizeBusinessCardImages(placeCard.images),
          }
        : null,
      content: row.content,
      media_url: row.media_url,
      media_blurhashes: parseMediaBlurhashesColumn(row.media_blurhashes),
      created_at: row.created_at,
      reaction_count: reactionCountByStory.get(row.id) ?? 0,
      comment_count: commentCountByStory.get(row.id) ?? 0,
      my_reaction: myReactionByStory.get(row.id) ?? null,
      profile: profiles.get(row.user_id) ?? null,
      comment_preview: commentsByStory.get(row.id) ?? [],
      is_followed_author: followingSet.has(row.user_id),
      score,
    };
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const itemCount = page * FEED_PAGE_SIZE;
  return {
    stories: scored.slice(0, itemCount).map(({ score: _score, ...story }) => story),
    hasMore: stories.length >= fetchLimit,
    page,
  };
}

export function useStoriesFeed() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { followingIds, followingSet } = useMyFollowing();
  const followingSignature = useMemo(() => [...followingIds].sort().join(","), [followingIds]);

  const feedQueryKey = queryKeys.stories.feed(user?.id ?? null, followingSignature);

  const query = useInfiniteQuery({
    queryKey: feedQueryKey,
    initialPageParam: 1,
    maxPages: 1,
    staleTime: 45 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async ({ pageParam }) =>
      fetchStoriesFeedPage({
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
    stories: lastPage?.stories ?? [],
    hasMore: lastPage?.hasMore ?? false,
    loadMore: () => void query.fetchNextPage(),
    resetFeed,
  };
}
