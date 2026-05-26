import type { FeedStoryItem } from "../api/fetchStoriesFeedPage";

/** Approximate server feed order using fields available on FeedStoryItem. */
export function compareFeedStories(a: FeedStoryItem, b: FeedStoryItem): number {
  const scoreA = a.is_followed_author ? 0 : 1;
  const scoreB = b.is_followed_author ? 0 : 1;
  if (scoreA !== scoreB) return scoreA - scoreB;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function sortFeedStories(stories: FeedStoryItem[]): FeedStoryItem[] {
  return [...stories].sort(compareFeedStories);
}
