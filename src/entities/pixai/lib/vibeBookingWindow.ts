import type { VibePlanStop } from "../api/usePixAI";

/** Earliest suggested booking time from now. */
export const VIBE_BOOKING_WINDOW_MIN_MS = 30 * 60_000;
/** Local clock window: 7:00 AM through 2:00 AM (next calendar segment). */
export const VIBE_CLOCK_START_MINUTES = 7 * 60;
export const VIBE_CLOCK_END_MINUTES = 2 * 60;
export const VIBE_STOP_SPACING_MS = 90 * 60_000;
export const VIBE_SLOT_GRID_MS = 30 * 60_000;

export type VibeBookingWindow = { startMs: number; endMs: number };

export function isWithinVibeClockRange(totalMinutes: number): boolean {
  return totalMinutes >= VIBE_CLOCK_START_MINUTES || totalMinutes <= VIBE_CLOCK_END_MINUTES;
}

function localMinutesOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

function nextSevenAmMs(fromMs: number): number {
  const d = new Date(fromMs);
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const sevenToday = new Date(y, m, day, 7, 0, 0, 0).getTime();
  if (fromMs <= sevenToday) return sevenToday;
  return new Date(y, m, day + 1, 7, 0, 0, 0).getTime();
}

function bookingWindowEndMs(fromMs: number): number {
  const d = new Date(fromMs);
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const mins = localMinutesOfDay(fromMs);
  if (mins <= VIBE_CLOCK_END_MINUTES) {
    return new Date(y, m, day, 2, 0, 0, 0).getTime();
  }
  return new Date(y, m, day + 1, 2, 0, 0, 0).getTime();
}

export function getVibeBookingWindow(nowMs = Date.now()): VibeBookingWindow {
  const minStart = nowMs + VIBE_BOOKING_WINDOW_MIN_MS;
  let startMs = minStart;
  if (!isWithinVibeClockRange(localMinutesOfDay(minStart))) {
    startMs = nextSevenAmMs(minStart);
  }
  const endMs = bookingWindowEndMs(startMs);
  return { startMs, endMs };
}

export function isTimeSlotInVibeBookingWindow(iso: string, nowMs = Date.now()): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  if (!isWithinVibeClockRange(localMinutesOfDay(t))) return false;
  const { startMs, endMs } = getVibeBookingWindow(nowMs);
  return t >= startMs && t <= endMs;
}

export function filterVibePlanToBookingWindow(plan: VibePlanStop[], nowMs = Date.now()): VibePlanStop[] {
  return plan.filter((stop) => isTimeSlotInVibeBookingWindow(stop.time_slot, nowMs));
}

/** Round up to the next :00 / :30 and clamp inside the vibe booking window. */
export function snapIsoToThirtyMinuteGrid(iso: string, nowMs = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const { startMs, endMs } = getVibeBookingWindow(nowMs);
  const clamped = Math.min(endMs, Math.max(startMs, t));
  const ceiled = Math.ceil(clamped / VIBE_SLOT_GRID_MS) * VIBE_SLOT_GRID_MS;
  return new Date(Math.min(endMs, Math.max(startMs, ceiled))).toISOString();
}

export function normalizeVibePlanStops(plan: VibePlanStop[], nowMs = Date.now()): VibePlanStop[] {
  return filterVibePlanToBookingWindow(plan, nowMs).map((stop) => ({
    ...stop,
    time_slot: snapIsoToThirtyMinuteGrid(stop.time_slot, nowMs),
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
