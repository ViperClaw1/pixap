/** Presence heartbeat while the app is in the foreground. */
export const LAST_SEEN_HEARTBEAT_MS = 120_000;

/** Treat peer as online without presence sync if last_seen is this fresh. */
export const LAST_SEEN_ONLINE_THRESHOLD_MS = 3 * 60_000;

export const APP_PRESENCE_CHANNEL = "app_presence";
