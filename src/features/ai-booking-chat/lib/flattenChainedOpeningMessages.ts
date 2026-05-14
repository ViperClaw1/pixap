import { isPixBookingAssistantGreeting } from "../model/constants";
import type { BookingChatMessage } from "../model/types";

export type BookingChatListRow =
  | { kind: "chained_opening"; first: BookingChatMessage; second: BookingChatMessage }
  | { kind: "message"; item: BookingChatMessage };

/**
 * When the tab opens with greeting + scan line (two assistant bubbles), merge them for sequential typewriter UI.
 */
export function flattenChainedOpeningMessages(messages: BookingChatMessage[]): BookingChatListRow[] {
  if (messages.length >= 2) {
    const a = messages[0];
    const b = messages[1];
    if (
      a &&
      b &&
      a.role === "assistant" &&
      isPixBookingAssistantGreeting(a.content) &&
      b.role === "assistant" &&
      !isPixBookingAssistantGreeting(b.content)
    ) {
      return [
        { kind: "chained_opening", first: a, second: b },
        ...messages.slice(2).map((item) => ({ kind: "message", item } as const)),
      ];
    }
  }
  return messages.map((item) => ({ kind: "message", item } as const));
}

export function bookingChatListRowKey(row: BookingChatListRow): string {
  if (row.kind === "chained_opening") {
    return `chain:${row.first.id}:${row.second.id}`;
  }
  return row.item.id;
}
