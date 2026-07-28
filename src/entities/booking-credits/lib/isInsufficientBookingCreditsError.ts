/**
 * Matches the `insufficient_ai_credits` errcode raised by `consume_ai_query_credit` /
 * `consume_route_build_credit` (Pix AI concierge turns and route-building). Booking inserts
 * no longer consume credits, so this no longer fires from the booking flow.
 */
export function isInsufficientBookingCreditsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : String(error);
  const lower = message.toLowerCase();
  return lower.includes("insufficient_ai_credits") || lower.includes("insufficient_booking_credits");
}
