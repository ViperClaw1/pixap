import { useCallback, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth } from "@/app/providers/AuthProvider";
import type { StoryItem, StoryProfile, StoryReactionType } from "@/shared/model/types/stories";
import { STORIES_QUERY_KEY } from "./useStories";
import { parseMediaBlurhashesColumn } from "@/shared/lib/parseMediaBlurhashesColumn";

type StoryRow = {
  id: string;
  user_id: string;
  place_id: string | null;
  content: string;
  media_url: string | null;
  media_blurhashes?: unknown;
  created_at: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  username: string | null;
};

type PlaceCoordRow = {
  id: string;
  latitude: number | null;
  longitude: number | null;
};

export const storiesArchiveQueryKey = (userId: string) => [STORIES_QUERY_KEY, "archive", userId] as const;

export type ArchivedStoryCoords = { latitude: number; longitude: number };

export type ArchivedStoriesPayload = {
  stories: StoryItem[];
  coordsByStoryId: Record<string, ArchivedStoryCoords>;
};

type ArchivedStoriesPage = {
  profile: StoryProfile | null;
  rows: StoryRow[];
  commentsCount: Map<string, number>;
  reactionsCount: Map<string, number>;
  myReactionsMap: Map<string, StoryReactionType>;
  coordsByStoryId: Record<string, ArchivedStoryCoords>;
};

const ARCHIVE_PAGE_SIZE = 60;

function isMissingMediaBlurhashesError(message?: string) {
  return (message ?? "").toLowerCase().includes("media_blurhashes");
}

export function composeArchivedStoriesPayload(
  pages: ArchivedStoriesPage[],
): ArchivedStoriesPayload {
  const stories: StoryItem[] = [];
  const coordsByStoryId: Record<string, ArchivedStoryCoords> = {};
  const resolvedProfile = pages.find((page) => page.profile !== null)?.profile ?? null;

  for (const page of pages) {
    for (const [storyId, coords] of Object.entries(page.coordsByStoryId)) {
      coordsByStoryId[storyId] = coords;
    }
    for (const row of page.rows) {
      stories.push({
        id: row.id,
        user_id: row.user_id,
        place_id: row.place_id,
        content: row.content,
        media_url: row.media_url,
        media_blurhashes: parseMediaBlurhashesColumn(row.media_blurhashes),
        created_at: row.created_at,
        reaction_count: page.reactionsCount.get(row.id) ?? 0,
        comment_count: page.commentsCount.get(row.id) ?? 0,
        my_reaction: page.myReactionsMap.get(row.id) ?? null,
        profile: resolvedProfile,
      });
    }
  }

  return { stories, coordsByStoryId };
}

export function useMyArchivedStories() {
  const { user } = useAuth();

  const query = useInfiniteQuery({
    queryKey: storiesArchiveQueryKey(user?.id ?? ""),
    staleTime: 5 * 60 * 1000,
    gcTime: 8 * 60 * 1000,
    /** Ограничиваем число страниц в кэше — иначе длинный скролл архива раздувает память RQ. */
    maxPages: 24,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<ArchivedStoriesPage> => {
      const userId = user?.id;
      if (!userId) {
        return {
          profile: null,
          rows: [],
          commentsCount: new Map(),
          reactionsCount: new Map(),
          myReactionsMap: new Map(),
          coordsByStoryId: {},
        };
      }

      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const offset = Math.max(0, Number(pageParam) || 0);

      const to = offset + ARCHIVE_PAGE_SIZE - 1;
      const from = offset;
      const storiesSelectWithBlur = "id, user_id, place_id, content, media_url, created_at, media_blurhashes";
      const storiesSelectLegacy = "id, user_id, place_id, content, media_url, created_at";

      let { data: pagedStoriesData, error: pagedStoriesError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("stories" as any)
        .select(storiesSelectWithBlur)
        .eq("user_id", userId)
        .lt("created_at", cutoff)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (pagedStoriesError && isMissingMediaBlurhashesError(pagedStoriesError.message)) {
        const retry = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("stories" as any)
          .select(storiesSelectLegacy)
          .eq("user_id", userId)
          .lt("created_at", cutoff)
          .order("created_at", { ascending: false })
          .range(from, to);
        pagedStoriesData = retry.data;
        pagedStoriesError = retry.error;
      }
      if (pagedStoriesError) throw pagedStoriesError;
      const rows = (pagedStoriesData ?? []) as unknown as StoryRow[];
      if (!rows.length) {
        return {
          profile: null,
          rows: [],
          commentsCount: new Map(),
          reactionsCount: new Map(),
          myReactionsMap: new Map(),
          coordsByStoryId: {},
        };
      }

      const storyIds = rows.map((s) => s.id);
      const placeIds = Array.from(new Set(rows.map((s) => s.place_id).filter((id): id is string => Boolean(id))));

      const [{ data: profilesData }, { data: commentsData }, { data: reactionsData }, myReactionsResult, placesResult] =
        await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase.from("public_profiles" as any).select("id, first_name, last_name, avatar_url, username").eq("id", userId).maybeSingle(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase.from("story_comments" as any).select("id, story_id").in("story_id", storyIds),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase.from("story_reactions" as any).select("id, story_id").in("story_id", storyIds),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase.from("story_reactions" as any).select("story_id, type").eq("user_id", userId).in("story_id", storyIds),
          placeIds.length
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              supabase.from("business_cards" as any).select("id, latitude, longitude").in("id", placeIds)
            : Promise.resolve({ data: [] as unknown[] }),
        ]);

      const profileRow = profilesData as unknown as ProfileRow | null;
      const profile: StoryProfile | null = profileRow
        ? {
            id: profileRow.id,
            first_name: profileRow.first_name,
            last_name: profileRow.last_name,
            avatar_url: profileRow.avatar_url,
            username: profileRow.username,
          }
        : null;

      const commentsCount = new Map<string, number>();
      for (const row of (commentsData ?? []) as unknown as Array<{ story_id: string }>) {
        commentsCount.set(row.story_id, (commentsCount.get(row.story_id) ?? 0) + 1);
      }

      const reactionsCount = new Map<string, number>();
      for (const row of (reactionsData ?? []) as unknown as Array<{ story_id: string }>) {
        reactionsCount.set(row.story_id, (reactionsCount.get(row.story_id) ?? 0) + 1);
      }

      const myReactionsMap = new Map<string, StoryReactionType>();
      const myReactionRows =
        (myReactionsResult as unknown as { data: Array<{ story_id: string; type: StoryReactionType }> | null }).data ?? [];
      for (const row of myReactionRows) {
        myReactionsMap.set(row.story_id, row.type);
      }

      const coordsByStoryId: Record<string, ArchivedStoryCoords> = {};
      const placeCoords = new Map<string, { lat: number; lng: number }>();
      for (const p of (placesResult.data ?? []) as unknown as PlaceCoordRow[]) {
        if (p.latitude != null && p.longitude != null && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) {
          placeCoords.set(p.id, { lat: p.latitude, lng: p.longitude });
        }
      }
      for (const row of rows) {
        if (!row.place_id) continue;
        const c = placeCoords.get(row.place_id);
        if (c) coordsByStoryId[row.id] = { latitude: c.lat, longitude: c.lng };
      }

      return { profile, rows, commentsCount, reactionsCount, myReactionsMap, coordsByStoryId };
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.rows.length < ARCHIVE_PAGE_SIZE) return undefined;
      return allPages.reduce((acc, page) => acc + page.rows.length, 0);
    },
    enabled: Boolean(user?.id),
  });

  const archiveData = useMemo(() => {
    const userId = user?.id;
    if (!userId) return { stories: [] as StoryItem[], coordsByStoryId: {} as Record<string, ArchivedStoryCoords> };
    return composeArchivedStoriesPayload(query.data?.pages ?? []);
  }, [query.data?.pages, user?.id]);

  const ensureAllPagesLoaded = useCallback(async (): Promise<ArchivedStoriesPayload> => {
    let pages = query.data?.pages ?? [];
    let hasMore = query.hasNextPage ?? false;
    let guard = 0;
    while (hasMore && guard < 100) {
      const result = await query.fetchNextPage();
      pages = result.data?.pages ?? pages;
      const lastPage = pages[pages.length - 1];
      hasMore = Boolean(lastPage && lastPage.rows.length >= ARCHIVE_PAGE_SIZE);
      guard += 1;
    }
    return composeArchivedStoriesPayload(pages);
  }, [query.data?.pages, query.fetchNextPage, query.hasNextPage]);

  return {
    ...query,
    data: archiveData,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    ensureAllPagesLoaded,
  };
}
