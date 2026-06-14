import type { BookingChatContext, PlaceLite, AiBookingChatResult } from "../model/types";
import type { PixAISearchMeta } from "@/entities/pixai";

export type BookingChatTurnInput = {
  bookingContext: BookingChatContext;
  places: PlaceLite[];
  /** Prior turns (user + assistant), no system */
  history: { role: "user" | "assistant"; content: string }[];
  userText: string;
  searchMeta?: PixAISearchMeta | null;
  /** App UI locale code (en, ru, es, …) — assistant replies in this language */
  locale?: string;
  signal?: AbortSignal;
};

/**
 * Pluggable LLM backend. UI and store depend only on this contract.
 * Optional streaming entrypoint for future incremental tokens without breaking `sendTurn` callers.
 */
export type AiBookingChatProvider = {
  sendTurn(input: BookingChatTurnInput): Promise<AiBookingChatResult>;
  sendTurnStream?: (
    input: BookingChatTurnInput,
    sink: { onPartialText?: (chunk: string) => void },
  ) => AsyncIterable<AiBookingChatResult>;
};
