import type { PixAISearchMeta } from "@/entities/pixai";
import type { AiBookingChatResult } from "../model/types";
import { softenAssistantFallbackTone } from "./softenAssistantFallbackTone";

export function buildAssistantReplyText(
  result: AiBookingChatResult,
  opts?: { searchMeta?: PixAISearchMeta | null },
): string {
  const raw =
    result.explanation && result.explanation.trim().length > 0
      ? `${result.message}\n\n${result.explanation}`
      : result.message;
  return softenAssistantFallbackTone(raw, {
    isFallback: opts?.searchMeta?.is_fallback,
    hasFtsMatch: opts?.searchMeta?.fts_matched,
  });
}
