/** Same cadence as `executeBookingAssistantTurn` streaming (default `revealAssistantText` tick). */
export const DEFAULT_ASSISTANT_TYPEWRITER_TICK_MS = 16;
export const GREETING_ASSISTANT_TYPEWRITER_TICK_MS = 24;

export type RevealAssistantTextResult = {
  promise: Promise<void>;
  cancel: () => void;
};

/**
 * Reveals full assistant text progressively (client-side) for a typing effect.
 */
export function revealAssistantText(options: {
  fullText: string;
  onUpdate: (partial: string) => void;
  tickMs?: number;
  signal?: AbortSignal;
}): RevealAssistantTextResult {
  const { fullText, onUpdate, tickMs = DEFAULT_ASSISTANT_TYPEWRITER_TICK_MS, signal } = options;
  const total = fullText.length;
  if (total === 0) {
    onUpdate("");
    return { promise: Promise.resolve(), cancel: () => {} };
  }

  const baseChunk = Math.max(1, Math.min(6, Math.ceil(total / 45)));
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const cancel = () => {
    cancelled = true;
    if (timeoutId != null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  signal?.addEventListener("abort", cancel, { once: true });

  const promise = new Promise<void>((resolve) => {
    let pos = 0;
    const step = () => {
      if (cancelled || signal?.aborted) {
        resolve();
        return;
      }
      const tail = total - pos;
      const chunk = pos < total * 0.88 ? baseChunk : Math.min(baseChunk + 3, Math.max(2, Math.ceil(tail / 4)));
      pos = Math.min(total, pos + chunk);
      onUpdate(fullText.slice(0, pos));
      if (pos >= total) {
        resolve();
        return;
      }
      timeoutId = setTimeout(step, tickMs);
    };
    timeoutId = setTimeout(step, tickMs);
  });

  return { promise, cancel };
}
