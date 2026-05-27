export const DISCUSSION_COMMENTS_INITIAL_VISIBLE = 10;
export const DISCUSSION_COMMENTS_PAGE_SIZE = 10;
export const DISCUSSION_REPLIES_INITIAL_VISIBLE = 2;
export const DISCUSSION_REPLIES_PAGE_SIZE = 10;

export function getVisibleDiscussionComments<T>(sorted: T[], visibleCount: number): T[] {
  if (sorted.length <= DISCUSSION_COMMENTS_INITIAL_VISIBLE) return sorted;
  const start = Math.max(0, sorted.length - visibleCount);
  return sorted.slice(start);
}

export function hasHiddenDiscussionComments(total: number, visibleCount: number): boolean {
  return total > DISCUSSION_COMMENTS_INITIAL_VISIBLE && visibleCount < total;
}

export function getVisibleDiscussionReplies<T>(replies: T[], visibleCount: number): T[] {
  if (replies.length <= DISCUSSION_REPLIES_INITIAL_VISIBLE) return replies;
  const start = Math.max(0, replies.length - visibleCount);
  return replies.slice(start);
}

export function hasHiddenDiscussionReplies(total: number, visibleCount: number): boolean {
  return total > DISCUSSION_REPLIES_INITIAL_VISIBLE && visibleCount < total;
}
