import type { BookingDisplayStatus } from "../api/useBookings";

/** Venue responded positively: draft → confirmed or payment awaiting (via wa_confirmable / wa_status_lines). */
export function isVenueConfirmationTransition(
  previous: BookingDisplayStatus,
  current: BookingDisplayStatus,
): boolean {
  return previous === "draft" && (current === "confirmed" || current === "payment awaiting");
}
