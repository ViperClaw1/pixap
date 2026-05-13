import type { AiBookingChatProvider, BookingChatTurnInput } from "./aiBookingChatProvider";
import { invokePixaiBookingChatWithAuth, parseAiBookingChatResponse } from "./invokePixaiBookingChat";

function toWireBody(input: BookingChatTurnInput) {
  return {
    booking_context: input.bookingContext,
    places: input.places,
    messages: input.history,
    user_message: input.userText,
  };
}

export function createGeminiBookingChatAdapter(): AiBookingChatProvider {
  return {
    async sendTurn(input: BookingChatTurnInput) {
      const { data, error } = await invokePixaiBookingChatWithAuth(toWireBody(input));
      if (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(msg || "Assistant request failed");
      }
      if (data && typeof data === "object" && "error" in data) {
        const errMsg = (data as { error?: unknown }).error;
        throw new Error(typeof errMsg === "string" ? errMsg : "Assistant request failed");
      }
      return parseAiBookingChatResponse(data);
    },
  };
}

export const defaultBookingChatProvider = createGeminiBookingChatAdapter();
