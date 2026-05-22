type FeedSortablePost = {
  boosted_at?: string | null;
  created_at: string;
  score?: number;
};

export function boostedAtMs(boostedAt: string | null | undefined): number {
  if (!boostedAt) return 0;
  const ms = new Date(boostedAt).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function createdAtMs(createdAt: string): number {
  const ms = new Date(createdAt).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Boosted first (newest boost wins), then recency — for a single author's timeline. */
export function comparePostsByBoostThenCreated(a: FeedSortablePost, b: FeedSortablePost): number {
  const boostA = boostedAtMs(a.boosted_at);
  const boostB = boostedAtMs(b.boosted_at);
  if (boostA !== boostB) return boostB - boostA;
  return createdAtMs(b.created_at) - createdAtMs(a.created_at);
}

/** Discovery feed: boost → created_at → following/interacted score. */
export function compareFeedPosts(a: FeedSortablePost, b: FeedSortablePost): number {
  const boostA = boostedAtMs(a.boosted_at);
  const boostB = boostedAtMs(b.boosted_at);
  if (boostA !== boostB) return boostB - boostA;

  const createdDiff = createdAtMs(b.created_at) - createdAtMs(a.created_at);
  if (createdDiff !== 0) return createdDiff;

  const scoreA = a.score ?? 0;
  const scoreB = b.score ?? 0;
  return scoreA - scoreB;
}
