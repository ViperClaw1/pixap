import { devInfo } from "@/shared/lib/devLog";

export type RealtimeChannelScope =
  | "messages_inbox"
  | "messages_thread"
  | "posts_feed"
  | "stories_feed"
  | "notifications"
  | "ai_generation"
  | "other";

type ChannelStatus = "subscribed" | "error" | "closed" | "connecting";

let sessionReconnectCount = 0;
let channelErrorCount = 0;
let statusWindowStartedAt = 0;
let statusTransitionsInWindow = 0;

const STATUS_LOG_WINDOW_MS = 15_000;

const REALTIME_PERF_ENABLED = __DEV__;

export function recordRealtimeReconnect(reason: string): void {
  sessionReconnectCount += 1;
  if (REALTIME_PERF_ENABLED) {
    devInfo(`[realtime-perf] reconnect #${sessionReconnectCount} (${reason})`);
  }
}

export function recordRealtimeChannelStatus(scope: RealtimeChannelScope, status: ChannelStatus, channelKey: string): void {
  const now = Date.now();
  if (!statusWindowStartedAt || now - statusWindowStartedAt > STATUS_LOG_WINDOW_MS) {
    if (REALTIME_PERF_ENABLED && statusTransitionsInWindow > 0) {
      devInfo(`[realtime-perf] status transitions ${statusTransitionsInWindow} in ${STATUS_LOG_WINDOW_MS}ms`);
    }
    statusWindowStartedAt = now;
    statusTransitionsInWindow = 0;
  }
  statusTransitionsInWindow += 1;

  if (status === "error") channelErrorCount += 1;

  if (REALTIME_PERF_ENABLED) {
    devInfo(`[realtime-perf] ${scope} ${status} ${channelKey}`);
  }
}

export function getRealtimePerfSnapshot(): {
  sessionReconnectCount: number;
  channelErrorCount: number;
} {
  return { sessionReconnectCount, channelErrorCount };
}

export function resetRealtimePerfForTests(): void {
  sessionReconnectCount = 0;
  channelErrorCount = 0;
  statusWindowStartedAt = 0;
  statusTransitionsInWindow = 0;
}
