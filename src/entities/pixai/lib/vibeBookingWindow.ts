import type { VibePlanStop } from "../api/usePixAI";

/** Earliest suggested booking time from now. */
export const VIBE_BOOKING_WINDOW_MIN_MS = 30 * 60_000;
/** Latest suggested booking time from now. */
export const VIBE_BOOKING_WINDOW_MAX_MS = 8 * 60 * 60_000;
export const VIBE_STOP_SPACING_MS = 90 * 60_000;
export const VIBE_SLOT_GRID_MS = 30 * 60_000;

export type VibeBookingWindow = { startMs: number; endMs: number };

export function getVibeBookingWindow(nowMs = Date.now()): VibeBookingWindow {
  return {
    startMs: nowMs + VIBE_BOOKING_WINDOW_MIN_MS,
    endMs: nowMs + VIBE_BOOKING_WINDOW_MAX_MS,
  };
}

export function isTimeSlotInVibeBookingWindow(iso: string, nowMs = Date.now()): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const { startMs, endMs } = getVibeBookingWindow(nowMs);
  return t >= startMs && t <= endMs;
}

export function filterVibePlanToBookingWindow(plan: VibePlanStop[], nowMs = Date.now()): VibePlanStop[] {
  return plan.filter((stop) => isTimeSlotInVibeBookingWindow(stop.time_slot, nowMs));
}

/** Round to nearest :00 / :30 and clamp inside the vibe booking window. */
export function snapIsoToThirtyMinuteGrid(iso: string, nowMs = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const snapped = Math.round(t / VIBE_SLOT_GRID_MS) * VIBE_SLOT_GRID_MS;
  const { startMs, endMs } = getVibeBookingWindow(nowMs);
  const clamped = Math.min(endMs, Math.max(startMs, snapped));
  return new Date(clamped).toISOString();
}

export function normalizeVibePlanStops(plan: VibePlanStop[], nowMs = Date.now()): VibePlanStop[] {
  return filterVibePlanToBookingWindow(plan, nowMs).map((stop) => ({
    ...stop,
    time_slot: snapIsoToThirtyMinuteGrid(stop.time_slot, nowMs),
  }));
}
