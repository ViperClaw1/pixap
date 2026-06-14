import { BOOKING_SLOT_STEP_MINUTES } from "@/entities/booking/lib/bookingSlots";
import type { PixAIVibeTimeline, VibePlanStop } from "../api/usePixAI";

/** Earliest instant a booking can be created (not used for suggested route display). */
export const VIBE_BOOKING_WINDOW_MIN_MS = 30 * 60_000;

/** Slot grid + spacing between route stops inside a vibe time window. */
export const VIBE_WINDOW_SLOT_STEP_MINUTES = 120;
export const VIBE_STOP_SPACING_MS = VIBE_WINDOW_SLOT_STEP_MINUTES * 60_000;
export const VIBE_SLOT_GRID_MS = VIBE_WINDOW_SLOT_STEP_MINUTES * 60_000;

type TimelineWindowDef = {
  startMinutes: number;
  /** Exclusive upper bound in minutes-of-day (e.g. 16:30 inclusive → 16*60+31). */
  endMinutes: number;
};

export type VibeTimeWindowContext =
  | { kind: "preset"; timeline: PixAIVibeTimeline }
  | { kind: "custom"; startMinutes: number; endMinutes: number };

type ResolvedWindowDef = TimelineWindowDef & {
  wrapsMidnight: boolean;
};

function presetTimelineDef(timeline: PixAIVibeTimeline): ResolvedWindowDef {
  return {
    ...VIBE_TIMELINE_WINDOWS[timeline],
    wrapsMidnight: timeline === "night",
  };
}

function resolveWindowDef(context: VibeTimeWindowContext): ResolvedWindowDef {
  if (context.kind === "preset") {
    return presetTimelineDef(context.timeline);
  }
  const { startMinutes, endMinutes } = context;
  const wrapsMidnight = startMinutes > endMinutes;
  const exclusiveEnd = wrapsMidnight
    ? endMinutes + VIBE_WINDOW_SLOT_STEP_MINUTES
    : Math.min(24 * 60, endMinutes + VIBE_WINDOW_SLOT_STEP_MINUTES);
  return {
    startMinutes,
    endMinutes: exclusiveEnd,
    wrapsMidnight,
  };
}

/** Local clock ranges per vibe timeline chip. */
export const VIBE_TIMELINE_WINDOWS: Record<PixAIVibeTimeline, TimelineWindowDef> = {
  day: { startMinutes: 6 * 60, endMinutes: 16 * 60 + 31 },
  evening: { startMinutes: 17 * 60, endMinutes: 21 * 60 + 31 },
  night: { startMinutes: 22 * 60, endMinutes: 2 * 60 + 1 },
};

export type VibeBookingWindow = { startMs: number; endMs: number };

function localDayBounds(
  year: number,
  month: number,
  day: number,
  def: ResolvedWindowDef,
): { startMs: number; endMs: number } {
  const dayStart = new Date(year, month, day, 0, 0, 0, 0);
  const startMs = dayStart.getTime() + def.startMinutes * 60_000;
  let endMs: number;
  if (def.wrapsMidnight && def.startMinutes > def.endMinutes) {
    endMs = new Date(year, month, day + 1, 0, 0, 0, 0).getTime() + def.endMinutes * 60_000;
  } else if (def.endMinutes >= 24 * 60) {
    endMs = new Date(year, month, day + 1, 0, 0, 0, 0).getTime();
  } else {
    endMs = dayStart.getTime() + def.endMinutes * 60_000;
  }
  return { startMs, endMs };
}

function isLocalClockInWindowRange(minutesOfDay: number, def: ResolvedWindowDef): boolean {
  if (def.wrapsMidnight && def.startMinutes > def.endMinutes) {
    return minutesOfDay >= def.startMinutes || minutesOfDay < def.endMinutes;
  }
  if (def.wrapsMidnight) {
    return minutesOfDay >= def.startMinutes && minutesOfDay < def.endMinutes;
  }
  if (def.endMinutes >= 24 * 60) {
    return minutesOfDay >= def.startMinutes;
  }
  return minutesOfDay >= def.startMinutes && minutesOfDay < def.endMinutes;
}

function nextWindowOccurrences(
  def: ResolvedWindowDef,
  nowMs: number,
  maxDays = 4,
): VibeBookingWindow[] {
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

function nextTimelineWindows(
  timeline: PixAIVibeTimeline,
  nowMs: number,
  maxDays = 4,
): VibeBookingWindow[] {
  return nextWindowOccurrences(presetTimelineDef(timeline), nowMs, maxDays);
}

function nextContextWindows(context: VibeTimeWindowContext, nowMs: number, maxDays = 4): VibeBookingWindow[] {
  return nextWindowOccurrences(resolveWindowDef(context), nowMs, maxDays);
}

/** Next calendar occurrence of the timeline window (clock range only). */
export function getVibeTimelineWindow(timeline: PixAIVibeTimeline, nowMs = Date.now()): VibeBookingWindow {
  return nextTimelineWindows(timeline, nowMs)[0];
}

function getEffectiveVibeSlotBoundsFromWindows(
  windows: VibeBookingWindow[],
  fallback: VibeBookingWindow,
  nowMs: number,
): VibeBookingWindow {
  const minStartMs = nowMs + VIBE_BOOKING_WINDOW_MIN_MS;

  for (const { startMs, endMs } of windows) {
    const effectiveStartMs = Math.max(startMs, minStartMs);
    if (effectiveStartMs <= endMs) {
      return { startMs: effectiveStartMs, endMs };
    }
  }

  return {
    startMs: Math.min(fallback.endMs, Math.max(fallback.startMs, minStartMs)),
    endMs: fallback.endMs,
  };
}

/** Earliest bookable instant inside the selected timeline window: max(window start, now + 30 min). */
export function getEffectiveVibeSlotBounds(
  timeline: PixAIVibeTimeline,
  nowMs = Date.now(),
): VibeBookingWindow {
  const windows = nextTimelineWindows(timeline, nowMs);
  return getEffectiveVibeSlotBoundsFromWindows(windows, windows[0], nowMs);
}

export function getEffectiveVibeSlotBoundsForContext(
  context: VibeTimeWindowContext,
  nowMs = Date.now(),
): VibeBookingWindow {
  const windows = nextContextWindows(context, nowMs);
  return getEffectiveVibeSlotBoundsFromWindows(windows, windows[0], nowMs);
}

/** @deprecated alias */
export const getVibeBookingWindow = getVibeTimelineWindow;

export function isTimeSlotInTimelineWindow(
  iso: string,
  timeline: PixAIVibeTimeline,
  nowMs = Date.now(),
): boolean {
  return isTimeSlotInWindowContext(iso, { kind: "preset", timeline }, nowMs);
}

export function isTimeSlotInWindowContext(
  iso: string,
  context: VibeTimeWindowContext,
  nowMs = Date.now(),
): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const mins = new Date(t).getHours() * 60 + new Date(t).getMinutes();
  const def = resolveWindowDef(context);
  if (!isLocalClockInWindowRange(mins, def)) return false;
  const { startMs, endMs } = getEffectiveVibeSlotBoundsForContext(context, nowMs);
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

function snapMsToSlotGrid(ms: number, startMs: number, endMs: number): number {
  const clamped = Math.min(endMs, Math.max(startMs, ms));
  const ceiled = Math.ceil(clamped / VIBE_SLOT_GRID_MS) * VIBE_SLOT_GRID_MS;
  return Math.min(endMs, Math.max(startMs, ceiled));
}

/** Round up to the vibe slot grid inside the selected timeline window. */
export function snapIsoToThirtyMinuteGrid(
  iso: string,
  timeline: PixAIVibeTimeline,
  nowMs = Date.now(),
): string {
  return snapIsoToThirtyMinuteGridForContext(iso, { kind: "preset", timeline }, nowMs);
}

export function snapIsoToThirtyMinuteGridForContext(
  iso: string,
  context: VibeTimeWindowContext,
  nowMs = Date.now(),
): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const { startMs, endMs } = getEffectiveVibeSlotBoundsForContext(context, nowMs);
  return new Date(snapMsToSlotGrid(t, startMs, endMs)).toISOString();
}

/** Assign local timeline slots; first stop starts at now + 30 min within the selected window. */
export function normalizeVibePlanStops(
  plan: VibePlanStop[],
  timeline: PixAIVibeTimeline,
  nowMs = Date.now(),
): VibePlanStop[] {
  return normalizeVibePlanStopsForContext(plan, { kind: "preset", timeline }, nowMs);
}

export function normalizeVibePlanStopsForContext(
  plan: VibePlanStop[],
  context: VibeTimeWindowContext,
  nowMs = Date.now(),
): VibePlanStop[] {
  if (!plan.length) return [];

  const { startMs, endMs } = getEffectiveVibeSlotBoundsForContext(context, nowMs);

  return plan.map((stop, index) => ({
    ...stop,
    time_slot: new Date(
      snapMsToSlotGrid(startMs + index * VIBE_STOP_SPACING_MS, startMs, endMs),
    ).toISOString(),
  }));
}

/** 12-hour label for pickers and slots, e.g. `06:30 PM`. */
export function formatVibeMinutesLabel(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  return new Date(2000, 0, 1, hour, minute, 0, 0).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatVibeTimeWindowContextLabel(context: VibeTimeWindowContext, t: (key: string) => string): string {
  if (context.kind === "preset") {
    return t(`vibeMatch.timeline.${context.timeline}`);
  }
  return t("vibeMatch.customTimeRange", {
    start: formatVibeMinutesLabel(context.startMinutes),
    end: formatVibeMinutesLabel(context.endMinutes),
  });
}

/** 12-hour label for vibe route slots, e.g. `07:00 PM`. */
export function formatVibeSlotTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Booking API slots stay on a 30-minute grid; vibe windows use 2-hour steps. */
export const VIBE_BOOKING_SLOT_MATCH_MS = BOOKING_SLOT_STEP_MINUTES * 60_000;
