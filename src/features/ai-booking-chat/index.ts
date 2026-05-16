/**
 * AI booking concierge chat: multi-tab sessions, Gemini via `pixai-booking-chat` edge function.
 */
export { BookingInlineAssistantChat } from "./ui/BookingInlineAssistantChat";
export { BookingChatDock } from "./ui/BookingChatPanel";
export { BOOKING_ASSISTANT_GREETING } from "./model/constants";
export {
  useBookingChatStore,
  buildBookingContextFromPage,
  resetBookingChatPersistedSession,
} from "./model/bookingChatStore";
export type {
  BookingChatContext,
  BookingChatMessage,
  BookingRecommendationView,
  AiBookingChatResult,
} from "./model/types";
export { buildEffectivePlaces } from "./lib/buildEffectivePlaces";
export type { AiBookingChatProvider, BookingChatTurnInput } from "./api/aiBookingChatProvider";
export { createGeminiBookingChatAdapter, defaultBookingChatProvider } from "./api/geminiBookingChatAdapter";
export { invokePixaiBookingChatWithAuth, parseAiBookingChatResponse } from "./api/invokePixaiBookingChat";
