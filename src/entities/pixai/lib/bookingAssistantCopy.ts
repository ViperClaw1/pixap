import { i18n } from "@/shared/lib/i18n";

export const BOOKING_ASSISTANT_GREETING_ID_PREFIX = "pixai-greeting-";
export const PIXAI_WELCOME_MESSAGE_ID = "welcome";

/** Legacy English greeting stored in persisted chat before i18n. */
export const LEGACY_BOOKING_ASSISTANT_GREETING_EN =
  "Hi, I am PixAI. Tell me what service you want and I will find places, suggest the best slot, and prepare your booking.";

export function getBookingAssistantGreetingText(): string {
  return i18n.t("aiBooking.assistantGreeting");
}

export function isPixBookingAssistantGreeting(msg: { id: string; content: string }): boolean {
  if (msg.id.startsWith(BOOKING_ASSISTANT_GREETING_ID_PREFIX)) return true;
  if (msg.id === PIXAI_WELCOME_MESSAGE_ID) return true;
  return msg.content === LEGACY_BOOKING_ASSISTANT_GREETING_EN;
}

export function resolveBookingAssistantGreetingDisplay(msg: { id: string; content: string }): string {
  if (isPixBookingAssistantGreeting(msg)) return getBookingAssistantGreetingText();
  return msg.content;
}

export function createBookingAssistantGreetingMessageId(suffix: string | number): string {
  return `${BOOKING_ASSISTANT_GREETING_ID_PREFIX}${suffix}`;
}
