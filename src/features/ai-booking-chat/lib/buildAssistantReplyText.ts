import type { AiBookingChatResult } from "../model/types";

export function buildAssistantReplyText(result: AiBookingChatResult): string {
  if (result.explanation && result.explanation.trim().length > 0) {
    return `${result.message}\n\n${result.explanation}`;
  }
  return result.message;
}
