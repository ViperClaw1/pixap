import { flattenChainedOpeningMessages } from "./flattenChainedOpeningMessages";
import { isPixBookingAssistantGreeting } from "../model/constants";
import type { BookingChatMessage, BookingChatTab } from "../model/types";

/** Keys used by greeting / chained-opening typewriter (`messageId` or `firstId:secondId`). */
export function collectOpeningTypewriterKeysFromMessages(messages: BookingChatMessage[]): string[] {
  const keys: string[] = [];
  for (const row of flattenChainedOpeningMessages(messages)) {
    if (row.kind === "chained_opening") {
      keys.push(`${row.first.id}:${row.second.id}`);
      continue;
    }
    if (row.item.role === "assistant" && isPixBookingAssistantGreeting(row.item)) {
      keys.push(row.item.id);
    }
  }
  return keys;
}

export function collectOpeningTypewriterKeysFromTabs(tabs: BookingChatTab[]): string[] {
  const keys: string[] = [];
  for (const tab of tabs) {
    keys.push(...collectOpeningTypewriterKeysFromMessages(tab.messages));
  }
  return keys;
}
