/** Opening line for the booking assistant tab (Pix AI). */
export const BOOKING_ASSISTANT_GREETING =
  "Hi, I am PixAI. Tell me what service you want and I will find places, suggest the best slot, and prepare your booking.";

export function isPixBookingAssistantGreeting(content: string): boolean {
  return content === BOOKING_ASSISTANT_GREETING;
}
