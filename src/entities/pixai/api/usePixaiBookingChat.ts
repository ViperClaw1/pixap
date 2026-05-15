import { useMutation } from "@tanstack/react-query";
import { invokePixaiBookingChatWithAuth, parseAiBookingChatResponse } from "./invokePixaiBookingChat";
import type { AiBookingChatResult } from "../model/aiBookingChatTypes";

export function usePixaiBookingChat() {
  return useMutation({
    mutationFn: async (body: object): Promise<AiBookingChatResult> => {
      const { data, error } = await invokePixaiBookingChatWithAuth(body);
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
    retry: 1,
  });
}
