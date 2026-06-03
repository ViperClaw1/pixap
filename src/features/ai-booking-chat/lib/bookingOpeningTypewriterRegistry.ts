import { collectOpeningTypewriterKeysFromTabs } from "./collectOpeningTypewriterKeys";
import type { BookingChatTab } from "../model/types";

/** Keys = message id or `firstId:secondId` for chained opening; cleared when booking chat session resets. */
const completedOpeningTypewriterKeys = new Set<string>();

export function isBookingOpeningTypewriterComplete(key: string): boolean {
  return completedOpeningTypewriterKeys.has(key);
}

export function markBookingOpeningTypewriterComplete(key: string): void {
  completedOpeningTypewriterKeys.add(key);
}

export function clearBookingOpeningTypewriterRegistry(): void {
  completedOpeningTypewriterKeys.clear();
}

export function clearBookingOpeningTypewriterKeys(keys: Iterable<string>): void {
  for (const key of keys) {
    completedOpeningTypewriterKeys.delete(key);
  }
}

/** Restored tabs already contain full assistant text, so skip opening typewriter on rehydrate. */
export function syncOpeningTypewriterRegistryFromTabs(tabs: BookingChatTab[]): void {
  for (const tab of tabs) {
    for (const key of collectOpeningTypewriterKeysFromTabs([tab])) {
      markBookingOpeningTypewriterComplete(key);
    }
  }
}
