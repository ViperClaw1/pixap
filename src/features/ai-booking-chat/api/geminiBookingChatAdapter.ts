import type { AiBookingChatProvider, BookingChatTurnInput } from "./aiBookingChatProvider";
import { invokePixaiBookingChatWithAuth, parseAiBookingChatResponse } from "./invokePixaiBookingChat";

/** Sentinel thrown by sendTurn when the pixai-booking-chat function returns 402 (out of AI credits). */
export const INSUFFICIENT_AI_CREDITS_ERROR = "insufficient_ai_credits";

function isInsufficientCreditsHttpError(error: unknown): boolean {
  const ctx =
    error && typeof error === "object" && "context" in error
      ? (error as { context: unknown }).context
      : undefined;
  return ctx instanceof Response && ctx.status === 402;
}

function toWireBody(input: BookingChatTurnInput) {
  return {
    request_id: input.requestId,
    booking_context: input.bookingContext,
    places: input.places,
    messages: input.history,
    user_message: input.userText,
    meta: input.searchMeta ?? {},
    locale: input.locale ?? "en",
  };
}

export function createGeminiBookingChatAdapter(): AiBookingChatProvider {
  return {
    async sendTurn(input: BookingChatTurnInput) {
      const { data, error } = await invokePixaiBookingChatWithAuth(toWireBody(input));
      if (error) {
        if (isInsufficientCreditsHttpError(error)) {
          throw new Error(INSUFFICIENT_AI_CREDITS_ERROR);
        }
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(msg || "Assistant request failed");
      }
      if (data && typeof data === "object" && "error" in data) {
        const errMsg = (data as { error?: unknown }).error;
        if (errMsg === "insufficient_credits") {
          throw new Error(INSUFFICIENT_AI_CREDITS_ERROR);
        }
        throw new Error(typeof errMsg === "string" ? errMsg : "Assistant request failed");
      }
      return parseAiBookingChatResponse(data);
    },
  };
}

export const defaultBookingChatProvider = createGeminiBookingChatAdapter();
