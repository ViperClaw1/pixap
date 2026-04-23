import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { StoryGroup, StoryItem, StoryProfile, StoryReactionType } from "@/types/stories";

type StoryRow = {
  id: string;
  user_id: string;
  place_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export const STORIES_QUERY_KEY = "stories";

function groupStories(stories: StoryItem[]): StoryGroup[] {
  const grouped = new Map<string, StoryGroup>();
  for (const story of stories) {
    const existing = grouped.get(story.user_id);
    if (existing) {
      existing.stories.push(story);
      continue;
    }
    grouped.set(story.user_id, {
      user_id: story.user_id,
      profile: story.profile,
      stories: [story],
    });
  }
  return Array.from(grouped.values());
}

export const useStories = (placeId: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  useEffect(() => {
    if (!placeId) return;
    const channel = supabase
      .channel(`stories_place_${placeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stories", filter: `place_id=eq.${placeId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: [STORIES_QUERY_KEY, "place", placeId] });
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [placeId, queryClient]);

  const query = useQuery({
    queryKey: [STORIES_QUERY_KEY, "place", placeId, user?.id ?? null],
    queryFn: async () => {
      const { data: storiesData, error: storiesError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
        .from("stories" as any)
        .select("id, user_id, place_id, content, media_url, created_at")
        .eq("place_id", placeId)
        .order("created_at", { ascending: false });

      if (storiesError) throw storiesError;
      const stories = (storiesData ?? []) as StoryRow[];
      if (!stories.length) return [] as StoryItem[];

      const userIds = Array.from(new Set(stories.map((s) => s.user_id)));
      const storyIds = stories.map((s) => s.id);

      const [{ data: profilesData }, { data: commentsData }, { data: reactionsData }, myReactionsResult] =
        await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- keep implementation compatible before type regen
          supabase.from("profiles" as any).select("id, first_name, last_name, avatar_url").in("id", userIds),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- keep implementation compatible before type regen
          supabase.from("story_comments" as any).select("id, story_id").in("story_id", storyIds),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- keep implementation compatible before type regen
          supabase.from("story_reactions" as any).select("id, story_id").in("story_id", storyIds),
          user?.id
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- keep implementation compatible before type regen
              supabase.from("story_reactions" as any).select("story_id, type").eq("user_id", user.id).in("story_id", storyIds)
            : Promise.resolve({ data: [] }),
        ]);

      const profiles = new Map<string, StoryProfile>(
        ((profilesData ?? []) as ProfileRow[]).map((row) => [
          row.id,
          {
            id: row.id,
            first_name: row.first_name,
            last_name: row.last_name,
            avatar_url: row.avatar_url,
          },
        ]),
      );

      const commentsCount = new Map<string, number>();
      for (const row of (commentsData ?? []) as Array<{ story_id: string }>) {
        commentsCount.set(row.story_id, (commentsCount.get(row.story_id) ?? 0) + 1);
      }

      const reactionsCount = new Map<string, number>();
      for (const row of (reactionsData ?? []) as Array<{ story_id: string }>) {
        reactionsCount.set(row.story_id, (reactionsCount.get(row.story_id) ?? 0) + 1);
      }

      const myReactionsMap = new Map<string, StoryReactionType>();
      for (const row of ((myReactionsResult as { data?: Array<{ story_id: string; type: StoryReactionType }> }).data ??
        []) as Array<{ story_id: string; type: StoryReactionType }>) {
        myReactionsMap.set(row.story_id, row.type);
      }

      return stories.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        place_id: row.place_id,
        content: row.content,
        media_url: row.media_url,
        created_at: row.created_at,
        reaction_count: reactionsCount.get(row.id) ?? 0,
        comment_count: commentsCount.get(row.id) ?? 0,
        my_reaction: myReactionsMap.get(row.id) ?? null,
        profile: profiles.get(row.user_id) ?? null,
      })) as StoryItem[];
    },
    enabled: !!placeId,
    refetchInterval: realtimeConnected ? false : 15000,
  });

  const groupedStories = useMemo(() => groupStories(query.data ?? []), [query.data]);

  return {
    ...query,
    stories: query.data ?? [],
    groupedStories,
  };
};
