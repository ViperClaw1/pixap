/**
 * Polling fallbacks when Supabase Realtime is not SUBSCRIBED.
 * Intervals are conservative until reconnect metrics stabilize in production.
 */
export const REALTIME_POLL_MS = {
  messagesThread: 15_000,
  messagesInbox: 45_000,
  postsFeed: 45_000,
  storiesFeed: 25_000,
  storyComments: 15_000,
  postComments: 15_000,
  notifications: 30_000,
} as const;
