import type { QueryClient, InfiniteData } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import type { FeedStoryItem, StoriesFeedPage } from "../api/fetchStoriesFeedPage";
import type { StoryProfile, StoryReactionType } from "@/shared/model/types/stories";
import { parseMediaBlurhashesColumn } from "@/shared/lib/parseMediaBlurhashesColumn";
import { listHasId } from "@/shared/realtime/dedupe";
import { debouncedStoriesFeedInvalidate } from "./storyFeedRealtimeDebounce";
import { sortFeedStories } from "./compareFeedStories";

export type StoryStripItem = {
  id: string;
  user_id: string;
  created_at: string;
  media_url: string | null;
  media_blurhashes?: (string | null)[] | null;
  profile: StoryProfile | null;
};

function upsertCommentPreview(
  preview: FeedStoryItem["comment_preview"],
  comment: { id: string; content: string; created_at: string },
): FeedStoryItem["comment_preview"] {
  const filtered = preview.filter((row) => row.id !== comment.id);
  const next = [comment, ...filtered].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return next.slice(0, 2);
}

export function feedCachesContainStory(queryClient: QueryClient, storyId: string): boolean {
  const queries = queryClient.getQueriesData<InfiniteData<StoriesFeedPage>>({
    queryKey: queryKeys.stories.feedPrefix,
  });
  for (const [, data] of queries) {
    for (const page of data?.pages ?? []) {
      if (page.stories.some((story) => story.id === storyId)) return true;
    }
  }
  return false;
}

export function patchStoryInAllFeedCaches(
  queryClient: QueryClient,
  storyId: string,
  patch: (story: FeedStoryItem) => FeedStoryItem,
): boolean {
  let touched = false;
  const queries = queryClient.getQueriesData<InfiniteData<StoriesFeedPage>>({
    queryKey: queryKeys.stories.feedPrefix,
  });

  for (const [key, data] of queries) {
    if (!data?.pages?.length) continue;
    let pageTouched = false;
    const pages = data.pages.map((page) => {
      if (!page.stories.some((story) => story.id === storyId)) return page;
      pageTouched = true;
      return {
        ...page,
        stories: page.stories.map((story) => (story.id === storyId ? patch(story) : story)),
      };
    });
    if (pageTouched) {
      touched = true;
      queryClient.setQueryData<InfiniteData<StoriesFeedPage>>(key, { ...data, pages });
    }
  }

  return touched;
}

export function patchStoryReactionInFeedCaches(
  queryClient: QueryClient,
  storyId: string,
  options: {
    reactionCountDelta: number;
    viewerUserId?: string | null;
    reactionUserId?: string;
    reactionType?: StoryReactionType;
    removed?: boolean;
  },
): boolean {
  return patchStoryInAllFeedCaches(queryClient, storyId, (story) => {
    const reaction_count = Math.max(0, story.reaction_count + options.reactionCountDelta);
    let my_reaction = story.my_reaction;

    if (
      options.viewerUserId &&
      options.reactionUserId === options.viewerUserId &&
      options.reactionType === "like"
    ) {
      my_reaction = options.removed ? null : "like";
    }

    return { ...story, reaction_count, my_reaction };
  });
}

export function toggleStoryLikeInFeedCaches(queryClient: QueryClient, storyId: string): boolean {
  return patchStoryInAllFeedCaches(queryClient, storyId, (story) => {
    const wasLiked = story.my_reaction === "like";
    return {
      ...story,
      my_reaction: wasLiked ? null : "like",
      reaction_count: Math.max(0, story.reaction_count + (wasLiked ? -1 : 1)),
    };
  });
}

export function patchStoryCommentInFeedCaches(
  queryClient: QueryClient,
  storyId: string,
  options: {
    commentCountDelta: number;
    newComment?: { id: string; content: string; created_at: string };
    removedCommentId?: string;
  },
): boolean {
  return patchStoryInAllFeedCaches(queryClient, storyId, (story) => {
    const comment_count = Math.max(0, story.comment_count + options.commentCountDelta);
    let comment_preview = story.comment_preview;

    if (options.removedCommentId) {
      comment_preview = comment_preview.filter((row) => row.id !== options.removedCommentId);
    }
    if (options.newComment) {
      comment_preview = upsertCommentPreview(comment_preview, options.newComment);
    }

    return { ...story, comment_count, comment_preview };
  });
}

export function removeStoryFromFeedCaches(queryClient: QueryClient, storyId: string): void {
  const queries = queryClient.getQueriesData<InfiniteData<StoriesFeedPage>>({
    queryKey: queryKeys.stories.feedPrefix,
  });

  for (const [key, data] of queries) {
    if (!data?.pages?.length) continue;
    const pages = data.pages.map((page) => ({
      ...page,
      stories: page.stories.filter((story) => story.id !== storyId),
    }));
    queryClient.setQueryData<InfiniteData<StoriesFeedPage>>(key, { ...data, pages });
  }
}

export function prependStoryToFeedCaches(queryClient: QueryClient, story: FeedStoryItem): boolean {
  let touched = false;
  const queries = queryClient.getQueriesData<InfiniteData<StoriesFeedPage>>({
    queryKey: queryKeys.stories.feedPrefix,
  });

  for (const [key, data] of queries) {
    if (!data?.pages?.length) continue;
    if (listHasId(data.pages[0]?.stories, story.id)) continue;

    touched = true;
    queryClient.setQueryData<InfiniteData<StoriesFeedPage>>(key, {
      ...data,
      pages: data.pages.map((page, index) =>
        index === 0 ? { ...page, stories: sortFeedStories([story, ...page.stories]) } : page,
      ),
    });
  }

  return touched;
}

export function prependStoryToStripCache(queryClient: QueryClient, item: StoryStripItem): void {
  const key = queryKeys.stories.strip;
  const current = queryClient.getQueryData<StoryStripItem[]>(key);
  if (!current) return;
  if (listHasId(current, item.id)) return;
  queryClient.setQueryData<StoryStripItem[]>(key, [item, ...current]);
}

export function removeStoryFromStripCache(queryClient: QueryClient, storyId: string): void {
  const key = queryKeys.stories.strip;
  const current = queryClient.getQueryData<StoryStripItem[]>(key);
  if (!current?.length) return;
  queryClient.setQueryData<StoryStripItem[]>(
    key,
    current.filter((story) => story.id !== storyId),
  );
}

/** Debounced fallback when incremental patch is impossible (new remote story, scoring changes). */
export function scheduleStoriesFeedInvalidate(
  queryClient: QueryClient,
  debounceKey = "global",
  options?: { strip?: boolean },
): void {
  debouncedStoriesFeedInvalidate(debounceKey, () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.stories.feedPrefix });
    if (options?.strip !== false) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stories.strip });
    }
  });
}

export function scheduleStoriesStripInvalidate(queryClient: QueryClient, debounceKey = "strip"): void {
  debouncedStoriesFeedInvalidate(debounceKey, () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.stories.strip });
  });
}

export function buildFeedStoryFromCreate(params: {
  id: string;
  user_id: string;
  place_id: string | null;
  content: string;
  media_url: string | null;
  media_blurhashes?: unknown;
  created_at: string;
  profile: StoryProfile | null;
  followingSet: ReadonlySet<string>;
  placeName?: string;
  businessCard?: FeedStoryItem["business_card"];
}): FeedStoryItem {
  return {
    id: params.id,
    user_id: params.user_id,
    place_id: params.place_id,
    content: params.content,
    media_url: params.media_url,
    media_blurhashes: parseMediaBlurhashesColumn(params.media_blurhashes),
    created_at: params.created_at,
    reaction_count: 0,
    comment_count: 0,
    my_reaction: null,
    profile: params.profile,
    place_name: params.placeName ?? "Unknown place",
    business_card: params.businessCard ?? null,
    comment_preview: [],
    is_followed_author: params.followingSet.has(params.user_id),
  };
}

export function buildStripStoryFromCreate(params: {
  id: string;
  user_id: string;
  created_at: string;
  media_url: string | null;
  media_blurhashes?: unknown;
  profile: StoryProfile | null;
}): StoryStripItem {
  return {
    id: params.id,
    user_id: params.user_id,
    created_at: params.created_at,
    media_url: params.media_url,
    media_blurhashes: parseMediaBlurhashesColumn(params.media_blurhashes),
    profile: params.profile,
  };
}
