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
