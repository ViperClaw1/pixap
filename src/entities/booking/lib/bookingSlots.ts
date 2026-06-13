import type { PixAISlot } from "@/entities/pixai";

/** Daily booking grid: 00:00–23:30 local time, 30-minute steps. */
export const BOOKING_SLOT_START_MINUTES = 0;
export const BOOKING_SLOT_END_MINUTES = 23 * 60 + 30;
/** @deprecated Alias for BOOKING_SLOT_END_MINUTES. */
export const BOOKING_SLOT_EVENING_END_MINUTES = BOOKING_SLOT_END_MINUTES;
export const BOOKING_SLOT_STEP_MINUTES = 30;
export const BOOKING_SLOT_GRID_COLUMNS = 4;

/** Slots must start at least this far after "now" when the client builds the grid (same-day buffer). */
export const BOOKING_MIN_LEAD_MS = 30 * 60 * 1000;

function formatSlotLabel(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function buildBookingSlotTimeLabels(): string[] {
  const labels: string[] = [];
  for (
    let totalMinutes = BOOKING_SLOT_START_MINUTES;
    totalMinutes <= BOOKING_SLOT_END_MINUTES;
    totalMinutes += BOOKING_SLOT_STEP_MINUTES
  ) {
    labels.push(formatSlotLabel(totalMinutes));
  }
  return labels;
}

/** HH:mm labels for static pickers (BookingFlow). */
export const BOOKING_SLOT_TIME_LABELS = buildBookingSlotTimeLabels() as readonly string[];

function slotDateFromYmdAndMinutes(ymd: string, totalMinutes: number): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return new Date(y, m - 1, d, hour, minute, 0, 0);
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
    const dt = slotDateFromYmdAndMinutes(ymd, h * 60 + m);
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
