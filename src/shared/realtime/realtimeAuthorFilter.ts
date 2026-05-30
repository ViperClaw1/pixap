/** Supabase Realtime `in` filters have practical length limits on mobile channels. */
export const MAX_REALTIME_AUTHOR_IN_FILTER = 80;

export function buildAuthorUserIdInFilter(
  userId: string,
  followingIds: readonly string[],
): string | undefined {
  const ids = [...new Set([userId, ...followingIds])].filter(Boolean);
  if (ids.length === 0 || ids.length > MAX_REALTIME_AUTHOR_IN_FILTER) return undefined;
  return `user_id=in.(${ids.join(",")})`;
}

export function isRelevantFeedAuthor(
  authorUserId: string,
  userId: string,
  followingSet: ReadonlySet<string>,
): boolean {
  return authorUserId === userId || followingSet.has(authorUserId);
}
