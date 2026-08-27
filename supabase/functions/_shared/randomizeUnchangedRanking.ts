/** When Gemini returns the same order as before, shuffle so repeated asks feel fresh. */
export function randomizeUnchangedRanking(next: string[], previous: string[]): string[] {
  const unchanged =
    next.length > 1 &&
    next.length === previous.length &&
    next.every((id, index) => id === previous[index]);
  if (!unchanged) return next;

  const shuffled = [...next];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }

  if (shuffled.every((id, index) => id === next[index]) && shuffled.length > 1) {
    [shuffled[0], shuffled[1]] = [shuffled[1]!, shuffled[0]!];
  }
  return shuffled;
}
