/** Exponential backoff with jitter for channel resubscribe attempts. */
export function computeBackoffMs(attempt: number, baseMs = 1000, maxMs = 30_000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 0.3 * exp);
  return exp + jitter;
}
