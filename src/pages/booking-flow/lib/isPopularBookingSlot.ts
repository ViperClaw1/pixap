export function isPopularBookingSlot(dateTimeIso: string): boolean {
  const slotMs = new Date(dateTimeIso).getTime();
  if (!Number.isFinite(slotMs)) return false;
  const now = Date.now();
  const twoHoursMs = 2 * 60 * 60 * 1000;
  return slotMs >= now && slotMs <= now + twoHoursMs;
}
