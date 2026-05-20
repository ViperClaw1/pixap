export function isInsufficientBookingCreditsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : String(error);
  return message.toLowerCase().includes("insufficient_booking_credits");
}
