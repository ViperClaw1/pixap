import { devInfo } from "@/shared/lib/devLog";

const MESSAGING_PERF_ENABLED = __DEV__;

type MarkName = "inbox_open" | "thread_open";

const marks = new Map<MarkName, number>();
let invalidateCountWindow = 0;
let invalidateWindowStartedAt = 0;

const INVALIDATE_LOG_WINDOW_MS = 10_000;

/** Dev-only: mark start of inbox/thread navigation for TTI logging. */
export function markMessagingPerfStart(name: MarkName) {
  if (!MESSAGING_PERF_ENABLED) return;
  marks.set(name, Date.now());
}

/** Dev-only: log elapsed ms since markMessagingPerfStart. */
export function markMessagingPerfEnd(name: MarkName, detail?: string) {
  if (!MESSAGING_PERF_ENABLED) return;
  const started = marks.get(name);
  if (started == null) return;
  marks.delete(name);
  const ms = Date.now() - started;
  devInfo(`[messaging-perf] ${name} TTI ${ms}ms${detail ? ` (${detail})` : ""}`);
}

/** Dev-only: counts query invalidations in a rolling window (see useMessagesRealtime). */
export function recordMessagingInvalidate(scope: "inbox" | "thread") {
  if (!MESSAGING_PERF_ENABLED) return;
  const now = Date.now();
  if (!invalidateWindowStartedAt || now - invalidateWindowStartedAt > INVALIDATE_LOG_WINDOW_MS) {
    if (invalidateCountWindow > 0) {
      devInfo(`[messaging-perf] invalidates last ${INVALIDATE_LOG_WINDOW_MS}ms: ${invalidateCountWindow}`);
    }
    invalidateWindowStartedAt = now;
    invalidateCountWindow = 0;
  }
  invalidateCountWindow += 1;
  devInfo(`[messaging-perf] invalidate ${scope} (+${invalidateCountWindow} in window)`);
}
