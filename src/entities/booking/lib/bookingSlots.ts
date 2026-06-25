import type { PixAISlot } from "@/entities/pixai";

export type BookingTimeWindows = readonly { readonly startMinutes: number; readonly endMinutes: number }[];

/** Allowed local-time windows per calendar day (5-minute steps). */
export const BOOKING_TIME_WINDOWS: BookingTimeWindows = [
  { startMinutes: 0, endMinutes: 2 * 60 },
  { startMinutes: 6 * 60, endMinutes: 23 * 60 + 30 },
];

/** Allowed time windows for restaurants: 11:00–23:00. */
export const RESTAURANT_BOOKING_TIME_WINDOWS: BookingTimeWindows = [
  { startMinutes: 11 * 60, endMinutes: 23 * 60 },
];

/** Unbookable overnight gap shown as an inline picker warning (5-minute steps). */
export const BOOKING_RESTRICTED_TIME_WINDOW = {
  startMinutes: 2 * 60 + 30,
  endMinutes: 5 * 60 + 30,
} as const;

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

export function formatBookingTimeLabelAmPm(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
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

export function isBookingTimeInRestrictedWindow(totalMinutes: number): boolean {
  const snapped = snapToBookingTimeGrid(totalMinutes);
  return (
    snapped >= BOOKING_RESTRICTED_TIME_WINDOW.startMinutes &&
    snapped <= BOOKING_RESTRICTED_TIME_WINDOW.endMinutes
  );
}

export function buildBookingSlotTimeLabels(windows: BookingTimeWindows = BOOKING_TIME_WINDOWS): string[] {
  const labels: string[] = [];
  for (const window of windows) {
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

export function snapToNearestAllowedBookingMinutes(totalMinutes: number, windows?: BookingTimeWindows): number {
  const snapped = snapToBookingTimeGrid(totalMinutes);
  if (!windows) {
    if (isBookingTimeMinutesAllowed(snapped)) return snapped;
    let nearest = ALLOWED_BOOKING_MINUTES[0] ?? BOOKING_DEFAULT_TIME_MINUTES;
    let minDist = Math.abs(snapped - nearest);
    for (const candidate of ALLOWED_BOOKING_MINUTES) {
      const dist = Math.abs(snapped - candidate);
      if (dist < minDist) { minDist = dist; nearest = candidate; }
    }
    return nearest;
  }
  const allowed = buildBookingSlotTimeLabels(windows).map((label) => {
    const [h, m] = label.split(":").map(Number);
    return h * 60 + m;
  });
  if (allowed.includes(snapped)) return snapped;
  let nearest = allowed[0] ?? BOOKING_DEFAULT_TIME_MINUTES;
  let minDist = Math.abs(snapped - nearest);
  for (const candidate of allowed) {
    const dist = Math.abs(snapped - candidate);
    if (dist < minDist) { minDist = dist; nearest = candidate; }
  }
  return nearest;
}

export function bookingDateTimeFromYmd(ymd: string, totalMinutes: number): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

export function clampBookingPickerDate(dateYmd: string, picked: Date, windows?: BookingTimeWindows): Date {
  const minutes = snapToNearestAllowedBookingMinutes(minutesFromDate(picked), windows);
  return bookingDateTimeFromYmd(dateYmd, minutes);
}

export function defaultBookingDateTime(dateYmd: string): Date {
  return bookingDateTimeFromYmd(dateYmd, BOOKING_DEFAULT_TIME_MINUTES);
}

export function getAllowedBookingHours(windows?: BookingTimeWindows): number[] {
  const hours = new Set<number>();
  for (const label of buildBookingSlotTimeLabels(windows)) {
    hours.add(Number(label.split(":")[0]));
  }
  return [...hours].sort((a, b) => a - b);
}

export function getAllowedBookingMinutesForHour(hour: number, windows?: BookingTimeWindows): number[] {
  const minutes: number[] = [];
  for (const label of buildBookingSlotTimeLabels(windows)) {
    const [h, m] = label.split(":").map(Number);
    if (h === hour) minutes.push(m);
  }
  return minutes.sort((a, b) => a - b);
}

export function splitAllowedBookingTime(totalMinutes: number, windows?: BookingTimeWindows): { hour: number; minute: number } {
  const snapped = snapToNearestAllowedBookingMinutes(totalMinutes, windows);
  return { hour: Math.floor(snapped / 60), minute: snapped % 60 };
}

export function findBookingSlotForTime(slots: PixAISlot[], totalMinutes: number): PixAISlot | null {
  const label = formatBookingTimeLabel(snapToNearestAllowedBookingMinutes(totalMinutes));
  return slots.find((slot) => slot.label === label) ?? null;
}

export type BookingTimeUnavailableReason = "past" | "busy" | "restricted";

export function isBookingDateTimeInPast(dateYmd: string, totalMinutes: number): boolean {
  const dt = bookingDateTimeFromYmd(dateYmd, snapToNearestAllowedBookingMinutes(totalMinutes));
  return dt.getTime() < Date.now() + BOOKING_MIN_LEAD_MS;
}

export function resolveBookingTimeUnavailableReason(params: {
  slot: PixAISlot | null;
  dateYmd: string;
  totalMinutes: number;
  reservedInCart?: boolean;
}): BookingTimeUnavailableReason | null {
  const { slot, dateYmd, totalMinutes, reservedInCart = false } = params;
  const snapped = snapToBookingTimeGrid(totalMinutes);
  if (isBookingTimeInRestrictedWindow(snapped)) return "restricted";
  if (!isBookingTimeMinutesAllowed(snapped)) return "busy";
  if (!slot) return "busy";
  if (reservedInCart) return "busy";
  if (isBookingDateTimeInPast(dateYmd, totalMinutes)) return "past";
  if (!slot.available) return "busy";
  return null;
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
