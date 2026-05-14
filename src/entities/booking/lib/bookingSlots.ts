import type { PixAISlot } from "@/entities/pixai";

/** Hourly grid (local) for RPC-backed availability; includes evening for vibe / dinner flows. */
const SLOT_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] as const;

/** Slots must start at least this far after "now" when the client builds the grid (same-day buffer). */
export const BOOKING_MIN_LEAD_MS = 30 * 60 * 1000;

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
  const busy = new Set(bookingIsoTimes.map((iso) => new Date(iso).getHours()));
  const minStart = Date.now() + BOOKING_MIN_LEAD_MS;
  return SLOT_HOURS.map((hour) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, m - 1, d, hour, 0, 0, 0);
    const notBusy = !busy.has(hour);
    const pastLead = dt.getTime() < minStart;
    return {
      label: `${String(hour).padStart(2, "0")}:00`,
      dateTimeIso: dt.toISOString(),
      available: notBusy && !pastLead,
      isBest: false,
    };
  });
}
