import type { CartItem } from "@/entities/cart";
import type { Booking } from "../api/useBookings";

function bookingCartKey(businessCardId: string, dateTime: string): string {
  return `${businessCardId}|${dateTime}`;
}

/**
 * Picks the cart row that belongs to a booking row.
 * Multiple drafts for the same venue+slot are keyed the same; prefer an open cart (`created`)
 * and the item whose `created_at` is closest to the booking's.
 */
export function linkCartItemForBooking(
  booking: Pick<Booking, "business_card_id" | "date_time" | "created_at">,
  cartItems: CartItem[],
): CartItem | null {
  const key = bookingCartKey(booking.business_card_id, booking.date_time);
  const candidates = cartItems.filter((item) => bookingCartKey(item.business_card_id, item.date_time) === key);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const open = candidates.filter((item) => item.status === "created");
  const pool = open.length > 0 ? open : candidates;
  const bookingMs = new Date(booking.created_at).getTime();

  return pool.reduce((best, cur) => {
    const curMs = new Date(cur.created_at).getTime();
    const bestMs = new Date(best.created_at).getTime();
    const curDist = Math.abs(curMs - bookingMs);
    const bestDist = Math.abs(bestMs - bookingMs);
    if (curDist !== bestDist) return curDist < bestDist ? cur : best;
    return curMs > bestMs ? cur : best;
  });
}
