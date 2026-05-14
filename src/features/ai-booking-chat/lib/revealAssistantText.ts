/** Same cadence as `executeBookingAssistantTurn` streaming (default `revealAssistantText` tick). */
export const DEFAULT_ASSISTANT_TYPEWRITER_TICK_MS = 18;

/**
 * Reveals full assistant text progressively (client-side) for a typing effect.
 */
export function revealAssistantText(options: {
  fullText: string;
  onUpdate: (partial: string) => void;
  tickMs?: number;
}): Promise<void> {
  const { fullText, onUpdate, tickMs = DEFAULT_ASSISTANT_TYPEWRITER_TICK_MS } = options;
  const total = fullText.length;
  if (total === 0) {
    onUpdate("");
    return Promise.resolve();
  }

  const baseChunk = Math.max(1, Math.min(5, Math.ceil(total / 140)));

  return new Promise((resolve) => {
    let pos = 0;
    const step = () => {
      const tail = total - pos;
      const chunk = pos < total * 0.88 ? baseChunk : Math.min(baseChunk + 3, Math.max(2, Math.ceil(tail / 4)));
      pos = Math.min(total, pos + chunk);
      onUpdate(fullText.slice(0, pos));
      if (pos >= total) {
        resolve();
        return;
      }
      setTimeout(step, tickMs);
    };
    setTimeout(step, tickMs);
  });
}
