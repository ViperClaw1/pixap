export function resolvePeerLastSeenAt(params: {
  profileLastSeenAt: string | null | undefined;
  threadLastReadAt: string | null | undefined;
}): string | null {
  let best: string | null = null;
  let bestMs = -1;
  for (const value of [params.profileLastSeenAt, params.threadLastReadAt]) {
    if (!value) continue;
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms) || ms <= bestMs) continue;
    bestMs = ms;
    best = value;
  }
  return best;
}
