/** Public HTTPS link for a booking (universal link + email deep link). */
export function buildBookingShareLink(bookingId: string): string {
  return `https://pixapp.kz/bookings/${encodeURIComponent(bookingId.trim())}`;
}
