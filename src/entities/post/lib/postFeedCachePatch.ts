import type { QueryClient, InfiniteData } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import type { FeedPostItem } from "../api/usePostsFeed";
import type { FeedPostsCursor, FeedPostsPage } from "../api/fetchPostsFeedPage";
import { compareFeedPosts, comparePostsByBoostThenCreated } from "./compareFeedPosts";
import { pickLaterBoostedAt } from "./hydrateFeedPosts";
import { listHasId } from "@/shared/realtime/dedupe";
import { debouncedPostsFeedInvalidate } from "./postFeedRealtimeDebounce";

export type { FeedPostsCursor, FeedPostsPage };

type FeedPage = FeedPostsPage;

function authorUserIdFromFeedKey(key: readonly unknown[]): string | undefined {
  const value = key[4];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sortFeedPosts(posts: FeedPostItem[], authorUserId?: string): FeedPostItem[] {
  const compare = authorUserId ? comparePostsByBoostThenCreated : compareFeedPosts;
  return [...posts].sort(compare);
}

function mergeBoostedAtOnPost(fresh: FeedPostItem, cached: FeedPostItem): FeedPostItem {
  const boosted_at = pickLaterBoostedAt(fresh.boosted_at, cached.boosted_at);
  if (boosted_at === fresh.boosted_at) return fresh;
  return { ...fresh, boosted_at };
}

/**
 * Debounced feed invalidation — batches rapid postgres_changes (likes, comments, inserts).
 */
export function schedulePostsFeedInvalidate(queryClient: QueryClient, debounceKey = "global"): void {
  debouncedPostsFeedInvalidate(debounceKey, () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.posts.feedPrefix });
  });
}

/** Reads boosted_at from every loaded post feed cache (main + author-filtered). */
export function collectBoostedAtFromAllFeedCaches(queryClient: QueryClient): Map<string, string> {
  const boostedAtByPostId = new Map<string, string>();
  const queries = queryClient.getQueriesData<InfiniteData<FeedPage>>({ queryKey: queryKeys.posts.feedPrefix });

  for (const [, data] of queries) {
    for (const page of data?.pages ?? []) {
      for (const post of page.posts) {
        if (!post.boosted_at) continue;
        const prev = boostedAtByPostId.get(post.id);
        if (!prev || new Date(post.boosted_at).getTime() > new Date(prev).getTime()) {
          boostedAtByPostId.set(post.id, post.boosted_at);
        }
      }
    }
  }
  return boostedAtByPostId;
}

/** @deprecated Prefer collectBoostedAtFromAllFeedCaches */
export function collectBoostedAtFromFeedCache(
  queryClient: QueryClient,
  feedQueryKey: readonly unknown[],
): Map<string, string> {
  const boostedAtByPostId = new Map<string, string>();
  const cached = queryClient.getQueryData<InfiniteData<FeedPage>>(feedQueryKey);
  for (const page of cached?.pages ?? []) {
    for (const post of page.posts) {
      if (post.boosted_at) boostedAtByPostId.set(post.id, post.boosted_at);
    }
  }
  return boostedAtByPostId;
}

export function collectPostsFromFeedCache(
  queryClient: QueryClient,
  feedQueryKey: readonly unknown[],
): FeedPostItem[] {
  const cached = queryClient.getQueryData<InfiniteData<FeedPage>>(feedQueryKey);
  const posts: FeedPostItem[] = [];
  for (const page of cached?.pages ?? []) {
    posts.push(...page.posts);
  }
  return posts;
}

/**
 * Keeps posts that were already on screen when refetch returns a smaller global window
 * (e.g. after creating a new post + invalidate).
 */
export function mergeRefetchedFeedPageWithCache(
  page: FeedPage,
  cachedPosts: FeedPostItem[],
  options?: { authorUserId?: string },
): FeedPage {
  if (!cachedPosts.length) return page;

  const authorUserId = options?.authorUserId;
  const byId = new Map<string, FeedPostItem>();
  for (const post of page.posts) byId.set(post.id, post);
  for (const post of cachedPosts) {
    if (authorUserId && post.user_id !== authorUserId) continue;
    const existing = byId.get(post.id);
    if (!existing) {
      byId.set(post.id, post);
      continue;
    }
    byId.set(post.id, mergeBoostedAtOnPost(existing, post));
  }

  const merged = sortFeedPosts([...byId.values()], authorUserId);

  return {
    ...page,
    posts: merged,
    hasMore: page.hasMore || merged.length > page.posts.length,
  };
}

/** Re-applies cached boosted_at when refetch omits the column; re-sorts feed. */
export function mergeBoostedAtIntoFeedPage(
  page: FeedPage,
  boostedAtByPostId: Map<string, string>,
  authorUserId?: string,
): FeedPage {
  if (!boostedAtByPostId.size) return page;
  const posts = sortFeedPosts(
    page.posts.map((post) => ({
      ...post,
      boosted_at: pickLaterBoostedAt(post.boosted_at, boostedAtByPostId.get(post.id)),
    })),
    authorUserId,
  );
  return { ...page, posts };
}

/** Immediately marks a post as boosted and moves it to the top in all feed caches. */
export function applyPostBoostInFeedCaches(
  queryClient: QueryClient,
  postId: string,
  boostedAt: string,
): void {
  const queries = queryClient.getQueriesData<InfiniteData<FeedPage>>({ queryKey: queryKeys.posts.feedPrefix });

  for (const [key, data] of queries) {
    if (!data?.pages?.length) continue;
    const authorUserId = authorUserIdFromFeedKey(key);
    let touched = false;
    const pages = data.pages.map((page) => {
      if (!page.posts.some((p) => p.id === postId)) return page;
      touched = true;
      const posts = sortFeedPosts(
        page.posts.map((p) => (p.id === postId ? { ...p, boosted_at: boostedAt } : p)),
        authorUserId,
      );
      return { ...page, posts };
    });
    if (touched) {
      queryClient.setQueryData<InfiniteData<FeedPage>>(key, { ...data, pages });
    }
  }
}

export function patchPostInAllFeedCaches(
  queryClient: QueryClient,
  postId: string,
  patch: (post: FeedPostItem) => FeedPostItem,
): boolean {
  let touched = false;
  const queries = queryClient.getQueriesData<InfiniteData<FeedPage>>({ queryKey: queryKeys.posts.feedPrefix });

  for (const [key, data] of queries) {
    if (!data?.pages?.length) continue;
    let pageTouched = false;
    const pages = data.pages.map((page) => {
      if (!page.posts.some((post) => post.id === postId)) return page;
      pageTouched = true;
      return {
        ...page,
        posts: page.posts.map((post) => (post.id === postId ? patch(post) : post)),
      };
    });
    if (pageTouched) {
      touched = true;
      queryClient.setQueryData<InfiniteData<FeedPage>>(key, { ...data, pages });
    }
  }

  return touched;
}

export function togglePostLikeInFeedCaches(queryClient: QueryClient, postId: string): boolean {
  return patchPostInAllFeedCaches(queryClient, postId, (post) => {
    const wasLiked = post.my_reaction === "like";
    return {
      ...post,
      my_reaction: wasLiked ? null : "like",
      reaction_count: Math.max(0, post.reaction_count + (wasLiked ? -1 : 1)),
    };
  });
}

export function prependPostToFeedCaches(queryClient: QueryClient, post: FeedPostItem): void {
  const queries = queryClient.getQueriesData<InfiniteData<FeedPage>>({ queryKey: queryKeys.posts.feedPrefix });

  for (const [key, data] of queries) {
    if (!data?.pages?.length) continue;
    const firstPage = data.pages[0];
    if (listHasId(firstPage.posts, post.id)) continue;

    queryClient.setQueryData<InfiniteData<FeedPage>>(key, {
      ...data,
      pages: data.pages.map((page, index) =>
        index === 0 ? { ...page, posts: [post, ...page.posts] } : page,
      ),
    });
  }
}
