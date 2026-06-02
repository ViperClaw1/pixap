import type { PixAIVibeTimeline, VibePlanStop } from "../api/usePixAI";

/** Earliest instant a booking can be created (not used for suggested route display). */
export const VIBE_BOOKING_WINDOW_MIN_MS = 30 * 60_000;
export const VIBE_STOP_SPACING_MS = 90 * 60_000;
export const VIBE_SLOT_GRID_MS = 30 * 60_000;

type TimelineWindowDef = {
  startMinutes: number;
  endMinutes: number;
};

/** Local clock ranges per vibe timeline chip. */
export const VIBE_TIMELINE_WINDOWS: Record<PixAIVibeTimeline, TimelineWindowDef> = {
  day: { startMinutes: 8 * 60, endMinutes: 18 * 60 },
  evening: { startMinutes: 18 * 60, endMinutes: 21 * 60 },
  night: { startMinutes: 21 * 60, endMinutes: 24 * 60 },
  late_night: { startMinutes: 0, endMinutes: 3 * 60 },
};

export type VibeBookingWindow = { startMs: number; endMs: number };

function localDayBounds(
  year: number,
  month: number,
  day: number,
  def: TimelineWindowDef,
): { startMs: number; endMs: number } {
  const dayStart = new Date(year, month, day, 0, 0, 0, 0);
  const startMs = dayStart.getTime() + def.startMinutes * 60_000;
  const endMs =
    def.endMinutes >= 24 * 60
      ? new Date(year, month, day + 1, 0, 0, 0, 0).getTime()
      : dayStart.getTime() + def.endMinutes * 60_000;
  return { startMs, endMs };
}

function isLocalClockInTimelineRange(minutesOfDay: number, timeline: PixAIVibeTimeline): boolean {
  const def = VIBE_TIMELINE_WINDOWS[timeline];
  if (timeline === "late_night") {
    return minutesOfDay >= def.startMinutes && minutesOfDay < def.endMinutes;
  }
  if (def.endMinutes >= 24 * 60) {
    return minutesOfDay >= def.startMinutes;
  }
  return minutesOfDay >= def.startMinutes && minutesOfDay < def.endMinutes;
}

function nextTimelineWindows(
  timeline: PixAIVibeTimeline,
  nowMs: number,
  maxDays = 4,
): VibeBookingWindow[] {
  const def = VIBE_TIMELINE_WINDOWS[timeline];
  const anchor = new Date(nowMs);
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  const windows: VibeBookingWindow[] = [];

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset += 1) {
    const { startMs, endMs } = localDayBounds(y, m, d + dayOffset, def);
    if (endMs > nowMs) {
      windows.push({ startMs, endMs });
    }
  }

  if (windows.length === 0) {
    windows.push(localDayBounds(y, m, d + 1, def));
  }

  return windows;
}

/** Next calendar occurrence of the timeline window (clock range only). */
export function getVibeTimelineWindow(timeline: PixAIVibeTimeline, nowMs = Date.now()): VibeBookingWindow {
  return nextTimelineWindows(timeline, nowMs)[0];
}

/** Earliest bookable instant inside the selected timeline window: max(window start, now + 30 min). */
export function getEffectiveVibeSlotBounds(
  timeline: PixAIVibeTimeline,
  nowMs = Date.now(),
): VibeBookingWindow {
  const minStartMs = nowMs + VIBE_BOOKING_WINDOW_MIN_MS;

  for (const { startMs, endMs } of nextTimelineWindows(timeline, nowMs)) {
    const effectiveStartMs = Math.max(startMs, minStartMs);
    if (effectiveStartMs <= endMs) {
      return { startMs: effectiveStartMs, endMs };
    }
  }

  const fallback = getVibeTimelineWindow(timeline, nowMs);
  return {
    startMs: Math.min(fallback.endMs, Math.max(fallback.startMs, minStartMs)),
    endMs: fallback.endMs,
  };
}

/** @deprecated alias */
export const getVibeBookingWindow = getVibeTimelineWindow;

export function isTimeSlotInTimelineWindow(
  iso: string,
  timeline: PixAIVibeTimeline,
  nowMs = Date.now(),
): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const mins = new Date(t).getHours() * 60 + new Date(t).getMinutes();
  if (!isLocalClockInTimelineRange(mins, timeline)) return false;
  const { startMs, endMs } = getEffectiveVibeSlotBounds(timeline, nowMs);
  return t >= startMs && t <= endMs;
}

/** Whether a slot is far enough in the future to book right now. */
export function isTimeSlotBookableNow(iso: string, nowMs = Date.now()): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= nowMs + VIBE_BOOKING_WINDOW_MIN_MS;
}

/** Full booking validation at checkout time. */
export function isTimeSlotInVibeBookingWindow(
  iso: string,
  timeline: PixAIVibeTimeline,
  nowMs = Date.now(),
): boolean {
  return isTimeSlotInTimelineWindow(iso, timeline) && isTimeSlotBookableNow(iso, nowMs);
}

function snapMsToThirtyMinuteGrid(ms: number, startMs: number, endMs: number): number {
  const clamped = Math.min(endMs, Math.max(startMs, ms));
  const ceiled = Math.ceil(clamped / VIBE_SLOT_GRID_MS) * VIBE_SLOT_GRID_MS;
  return Math.min(endMs, Math.max(startMs, ceiled));
}

/** Round up to :00 / :30 inside the selected timeline window. */
export function snapIsoToThirtyMinuteGrid(
  iso: string,
  timeline: PixAIVibeTimeline,
  nowMs = Date.now(),
): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const { startMs, endMs } = getEffectiveVibeSlotBounds(timeline, nowMs);
  return new Date(snapMsToThirtyMinuteGrid(t, startMs, endMs)).toISOString();
}

/** Assign local timeline slots; first stop starts at now + 30 min within the selected window. */
export function normalizeVibePlanStops(
  plan: VibePlanStop[],
  timeline: PixAIVibeTimeline,
  nowMs = Date.now(),
): VibePlanStop[] {
  if (!plan.length) return [];

  const { startMs, endMs } = getEffectiveVibeSlotBounds(timeline, nowMs);

  return plan.map((stop, index) => ({
    ...stop,
    time_slot: new Date(
      snapMsToThirtyMinuteGrid(startMs + index * VIBE_STOP_SPACING_MS, startMs, endMs),
    ).toISOString(),
  }));
}

/** 12-hour label for vibe route slots, e.g. `07:00 AM`. */
export function formatVibeSlotTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
