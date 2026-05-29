import { i18n } from "@/shared/lib/i18n";
import { resolveLegacySearchResultsLine } from "./buildSearchResultsAssistantLine";

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

export function resolveBookingTranscriptDisplay(msg: { id: string; content: string }): string {
  if (isPixBookingAssistantGreeting(msg)) return getBookingAssistantGreetingText();
  const legacySearch = resolveLegacySearchResultsLine(msg.content);
  if (legacySearch) return legacySearch;
  if (msg.content === "I could not find matching places. Try changing city, category, or search scope.") {
    return i18n.t("aiBooking.searchNoMatchingPlaces");
  }
  if (
    msg.content ===
    "Something went wrong with the booking assistant and no matching places were found. Check your connection, try again, or adjust city and category."
  ) {
    return i18n.t("aiBooking.searchOrchestratorFailed");
  }
  return msg.content;
}

/** @deprecated Use resolveBookingTranscriptDisplay */
export const resolveBookingAssistantGreetingDisplay = resolveBookingTranscriptDisplay;

export function createBookingAssistantGreetingMessageId(suffix: string | number): string {
  return `${BOOKING_ASSISTANT_GREETING_ID_PREFIX}${suffix}`;
}
