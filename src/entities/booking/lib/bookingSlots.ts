import type { PixAISlot } from "@/entities/pixai";

/** Allowed local-time windows per calendar day (5-minute steps). */
export const BOOKING_TIME_WINDOWS = [
  { startMinutes: 0, endMinutes: 60 },
  { startMinutes: 6 * 60, endMinutes: 23 * 60 + 30 },
] as const;

export const BOOKING_SLOT_STEP_MINUTES = 5;
export const BOOKING_SLOT_GRID_COLUMNS = 4;
export const BOOKING_DEFAULT_TIME_MINUTES = 18 * 60;

/** @deprecated Use BOOKING_TIME_WINDOWS. */
export const BOOKING_SLOT_START_MINUTES = BOOKING_TIME_WINDOWS[0].startMinutes;
/** @deprecated Use BOOKING_TIME_WINDOWS. */
export const BOOKING_SLOT_END_MINUTES = BOOKING_TIME_WINDOWS[1].endMinutes;
/** @deprecated Alias for BOOKING_SLOT_END_MINUTES. */
export const BOOKING_SLOT_EVENING_END_MINUTES = BOOKING_SLOT_END_MINUTES;

/** Slots must start at least this far after "now" when the client builds the grid (same-day buffer). */
export const BOOKING_MIN_LEAD_MS = 30 * 60 * 1000;

export function formatBookingTimeLabel(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function minutesFromDate(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function snapToBookingTimeGrid(totalMinutes: number): number {
  return Math.round(totalMinutes / BOOKING_SLOT_STEP_MINUTES) * BOOKING_SLOT_STEP_MINUTES;
}

export function isBookingTimeMinutesAllowed(totalMinutes: number): boolean {
  const snapped = snapToBookingTimeGrid(totalMinutes);
  return BOOKING_TIME_WINDOWS.some(
    (window) => snapped >= window.startMinutes && snapped <= window.endMinutes,
  );
}

export function buildBookingSlotTimeLabels(): string[] {
  const labels: string[] = [];
  for (const window of BOOKING_TIME_WINDOWS) {
    for (
      let totalMinutes = window.startMinutes;
      totalMinutes <= window.endMinutes;
      totalMinutes += BOOKING_SLOT_STEP_MINUTES
    ) {
      labels.push(formatBookingTimeLabel(totalMinutes));
    }
  }
  return labels;
}

/** HH:mm labels for availability grids and validation. */
export const BOOKING_SLOT_TIME_LABELS = buildBookingSlotTimeLabels() as readonly string[];

const ALLOWED_BOOKING_MINUTES = buildBookingSlotTimeLabels().map((label) => {
  const [h, m] = label.split(":").map(Number);
  return h * 60 + m;
});

export function snapToNearestAllowedBookingMinutes(totalMinutes: number): number {
  const snapped = snapToBookingTimeGrid(totalMinutes);
  if (isBookingTimeMinutesAllowed(snapped)) return snapped;

  let nearest = ALLOWED_BOOKING_MINUTES[0] ?? BOOKING_DEFAULT_TIME_MINUTES;
  let minDist = Math.abs(snapped - nearest);
  for (const candidate of ALLOWED_BOOKING_MINUTES) {
    const dist = Math.abs(snapped - candidate);
    if (dist < minDist) {
      minDist = dist;
      nearest = candidate;
    }
  }
  return nearest;
}

export function bookingDateTimeFromYmd(ymd: string, totalMinutes: number): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

export function clampBookingPickerDate(dateYmd: string, picked: Date): Date {
  const minutes = snapToNearestAllowedBookingMinutes(minutesFromDate(picked));
  return bookingDateTimeFromYmd(dateYmd, minutes);
}

export function defaultBookingDateTime(dateYmd: string): Date {
  return bookingDateTimeFromYmd(dateYmd, BOOKING_DEFAULT_TIME_MINUTES);
}

export function findBookingSlotForTime(slots: PixAISlot[], totalMinutes: number): PixAISlot | null {
  const label = formatBookingTimeLabel(snapToNearestAllowedBookingMinutes(totalMinutes));
  return slots.find((slot) => slot.label === label) ?? null;
}

function snapIsoToSlotMs(iso: string): number {
  const t = new Date(iso).getTime();
  const stepMs = BOOKING_SLOT_STEP_MINUTES * 60_000;
  return Math.round(t / stepMs) * stepMs;
}

/** Local calendar day [start, end) as ISO strings (matches AIBookingPage `toYmd`). */
export function localDayBoundsIso(ymd: string): { start: string; endExclusive: string } {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error("Invalid date");
  }
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const endExclusive = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { start: start.toISOString(), endExclusive: endExclusive.toISOString() };
}

export function buildSlotsFromBookingTimes(ymd: string, bookingIsoTimes: string[]): PixAISlot[] {
  const busy = new Set(bookingIsoTimes.map(snapIsoToSlotMs));
  const minStart = Date.now() + BOOKING_MIN_LEAD_MS;

  return buildBookingSlotTimeLabels().map((label) => {
    const [h, m] = label.split(":").map(Number);
    const dt = bookingDateTimeFromYmd(ymd, h * 60 + m);
    const notBusy = !busy.has(dt.getTime());
    const pastLead = dt.getTime() < minStart;
    return {
      label,
      dateTimeIso: dt.toISOString(),
      available: notBusy && !pastLead,
      isBest: false,
    };
  });
}
