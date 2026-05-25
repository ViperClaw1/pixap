/** Free service booking (no entry fee). */
export function isFreeBookingEntry(cost: number, venueConfirmedPrice: string | null): boolean {
  if (venueConfirmedPrice) return false;
  return !Number.isFinite(cost) || cost <= 0;
}

export type BookingListPriceParts = {
  amount: string;
  currency: string;
};

/** Amount + currency for paid bookings list row. */
export function bookingListPriceParts(
  cost: number,
  venueConfirmedPrice: string | null,
): BookingListPriceParts | null {
  if (venueConfirmedPrice) {
    const trimmed = venueConfirmedPrice.trim();
    const match = trimmed.match(/^([\d][\d.,\s]*)\s*(.+)$/);
    if (match) {
      return { amount: match[1].trim(), currency: match[2].trim() };
    }
    return { amount: trimmed, currency: "" };
  }
  if (!Number.isFinite(cost) || cost <= 0) return null;
  return { amount: cost.toLocaleString(), currency: "USD" };
}
