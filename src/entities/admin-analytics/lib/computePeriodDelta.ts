/** Percent change: ((current - previous) / previous) * 100. Returns 0 if previous is 0. */
export function computePeriodDeltaPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
