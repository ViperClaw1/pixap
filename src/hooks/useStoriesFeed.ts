import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { StoryItem, StoryProfile, StoryReactionType } from "@/types/stories";
import { useMyFollowing } from "./useUserFollows";

type StoryRow = {
  id: string;
  user_id: string;
  place_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
};

type PlaceRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export type FeedStoryItem = StoryItem & {
  place_name: string;
  comment_preview: Array<{ id: string; content: string; created_at: string }>;
  is_followed_author: boolean;
};

const FEED_PAGE_SIZE = 12;
const FETCH_WINDOW_MULTIPLIER = 4;

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

  const ownStoryPlaces = ((ownStoriesResult.data ?? []) as unknown as Array<{ place_id: string }>).map(
    (row) => row.place_id,
  );
  const relatedStoryIds = Array.from(
    new Set(
      [
        ...((ownReactionsResult.data ?? []) as unknown as Array<{ story_id: string | null }>).map((row) => row.story_id),
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
  for (const row of (relatedStories ?? []) as unknown as Array<{ place_id: string }>) {
    placeIds.add(row.place_id);
  }
  return Array.from(placeIds);
}

export function useStoriesFeed() {
  const { user } = useAuth();
  const { followingIds, followingSet } = useMyFollowing();
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["stories", "feed", user?.id ?? null, page, followingIds.join(",")],
    queryFn: async () => {
      const fetchLimit = page * FEED_PAGE_SIZE * FETCH_WINDOW_MULTIPLIER;
      const interactedPlaceIds = user?.id ? await getInteractedPlaceIds(user.id) : [];

      const { data: storiesData, error: storiesError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
        .from("stories" as any)
        .select("id, user_id, place_id, content, media_url, created_at")
        .order("created_at", { ascending: false })
        .limit(fetchLimit);
      if (storiesError) throw storiesError;

      const stories = (storiesData ?? []) as unknown as StoryRow[];
      if (!stories.length) return { stories: [] as FeedStoryItem[], hasMore: false };

      const storyIds = stories.map((row) => row.id);
      const placeIds = Array.from(new Set(stories.map((row) => row.place_id)));
      const userIds = Array.from(new Set(stories.map((row) => row.user_id)));

      const [{ data: placesData }, { data: profilesData }, { data: commentsData }, { data: reactionsData }, myReactionsResult] =
        await Promise.all([
          supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
            .from("business_cards" as any)
            .select("id, name")
            .in("id", placeIds),
          supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
            .from("public_profiles" as any)
            .select("id, first_name, last_name, avatar_url")
            .in("id", userIds),
          supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
            .from("story_comments" as any)
            .select("id, story_id, content, created_at")
            .in("story_id", storyIds)
            .order("created_at", { ascending: false }),
          supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
            .from("story_reactions" as any)
            .select("story_id")
            .in("story_id", storyIds),
          user?.id
            ? supabase
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
                .from("story_reactions" as any)
                .select("story_id, type")
                .eq("user_id", user.id)
                .in("story_id", storyIds)
            : Promise.resolve({ data: [] }),
        ]);

      const places = new Map<string, PlaceRow>(
        ((placesData ?? []) as unknown as PlaceRow[]).map((row) => [row.id, row]),
      );
      const profiles = new Map<string, StoryProfile>(
        ((profilesData ?? []) as unknown as ProfileRow[]).map((row) => [
          row.id,
          { id: row.id, first_name: row.first_name, last_name: row.last_name, avatar_url: row.avatar_url },
        ]),
      );

      const commentsByStory = new Map<string, Array<{ id: string; content: string; created_at: string }>>();
      const commentCountByStory = new Map<string, number>();
      for (const row of (commentsData ?? []) as unknown as Array<{ id: string; story_id: string; content: string; created_at: string }>) {
        commentCountByStory.set(row.story_id, (commentCountByStory.get(row.story_id) ?? 0) + 1);
        if (!commentsByStory.has(row.story_id)) commentsByStory.set(row.story_id, []);
        const existing = commentsByStory.get(row.story_id)!;
        if (existing.length < 2) existing.push({ id: row.id, content: row.content, created_at: row.created_at });
      }

      const reactionCountByStory = new Map<string, number>();
      for (const row of (reactionsData ?? []) as unknown as Array<{ story_id: string }>) {
        reactionCountByStory.set(row.story_id, (reactionCountByStory.get(row.story_id) ?? 0) + 1);
      }

      const myReactionByStory = new Map<string, StoryReactionType>();
      for (const row of ((myReactionsResult as { data?: Array<{ story_id: string; type: StoryReactionType }> }).data ??
        []) as Array<{ story_id: string; type: StoryReactionType }>) {
        myReactionByStory.set(row.story_id, row.type);
      }

      const interactedPlaceSet = new Set(interactedPlaceIds);
      const scored = stories.map((row) => {
        const score = followingSet.has(row.user_id) ? 0 : interactedPlaceSet.has(row.place_id) ? 1 : 2;
        return {
          id: row.id,
          user_id: row.user_id,
          place_id: row.place_id,
          place_name: places.get(row.place_id)?.name ?? "Unknown place",
          content: row.content,
          media_url: row.media_url,
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
      };
    },
  });

  return {
    ...query,
    stories: query.data?.stories ?? [],
    hasMore: query.data?.hasMore ?? false,
    loadMore: () => setPage((prev) => prev + 1),
    resetFeed: () => setPage(1),
  };
}
