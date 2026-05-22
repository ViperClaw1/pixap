export const POST_BOOST_COOLDOWN_MS = 60 * 60 * 1000;

export function isPostBoostOnCooldown(boostedAt: string | null | undefined, nowMs = Date.now()): boolean {
  if (!boostedAt) return false;
  const boostedMs = new Date(boostedAt).getTime();
  if (!Number.isFinite(boostedMs)) return false;
  return nowMs - boostedMs < POST_BOOST_COOLDOWN_MS;
}

export function isPostBoostCooldownError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.toLowerCase().includes("post_boost_cooldown");
}
