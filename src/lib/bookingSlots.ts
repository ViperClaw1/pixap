import type { PixAISlot } from "@/hooks/usePixAI";

const SLOT_HOURS = [10, 11, 12, 13, 14, 16, 17, 18] as const;

/** Local calendar day [start, end) as ISO strings (matches AIBookingScreen `toYmd`). */
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
  return SLOT_HOURS.map((hour) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, m - 1, d, hour, 0, 0, 0);
    return {
      label: `${String(hour).padStart(2, "0")}:00`,
      dateTimeIso: dt.toISOString(),
      available: !busy.has(hour),
      isBest: false,
    };
  });
}
