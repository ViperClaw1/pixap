import type { AiBookingChatProvider, BookingChatTurnInput } from "./aiBookingChatProvider";
import { parseAiBookingChatResponse } from "@/entities/pixai/api/invokePixaiBookingChat";
import {
  invokePixaiConciergeWithAuth,
  isPixaiConciergeInsufficientCreditsError,
} from "@/entities/pixai/api/invokePixaiConcierge";

/** Sentinel thrown by sendTurn when the concierge returns 402 (out of AI credits). */
export const INSUFFICIENT_AI_CREDITS_ERROR = "insufficient_ai_credits";

function isInsufficientCreditsHttpError(error: unknown): boolean {
  return isPixaiConciergeInsufficientCreditsError(error);
}

function toWireBody(input: BookingChatTurnInput) {
  return {
    action: "refine" as const,
    request_id: input.requestId,
    booking_context: input.bookingContext,
    places: input.places,
    messages: input.history,
    user_message: input.userText,
    previous_reranked_place_ids: input.previousRerankedPlaceIds,
    meta: input.searchMeta ?? {},
    locale: input.locale ?? "en",
  };
}

export function createGeminiBookingChatAdapter(): AiBookingChatProvider {
  return {
    async sendTurn(input: BookingChatTurnInput) {
      const { data, error } = await invokePixaiConciergeWithAuth(toWireBody(input));
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
