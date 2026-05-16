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

/** Restored / existing tabs: skip opening typewriter (only new tabs or fresh search openings animate). */
export function syncOpeningTypewriterRegistryFromTabs(tabs: BookingChatTab[]): void {
  for (const key of collectOpeningTypewriterKeysFromTabs(tabs)) {
    markBookingOpeningTypewriterComplete(key);
  }
}
