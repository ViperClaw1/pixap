import { useCallback, useEffect, useRef } from "react";
import { useMarkThreadRead } from "../api/useMarkThreadRead";

const MARK_READ_DEBOUNCE_MS = 500;
/** Skip redundant mark-read if one succeeded recently (guards focus-effect churn). */
const MARK_READ_MIN_INTERVAL_MS = 2_000;

/** Debounced mark-read while thread is focused — avoids refetch storms. */
export function useDebouncedMarkThreadRead(threadId: string | undefined, enabled: boolean) {
  const { mutateAsync, isPending } = useMarkThreadRead();
  const isPendingRef = useRef(isPending);
  isPendingRef.current = isPending;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastThreadRef = useRef<string | undefined>(undefined);
  const lastFlushAtRef = useRef(0);

  const flush = useCallback(() => {
    if (!threadId || !enabled) return;
    if (isPendingRef.current) return;
    const now = Date.now();
    if (now - lastFlushAtRef.current < MARK_READ_MIN_INTERVAL_MS) return;
    lastFlushAtRef.current = now;
    void mutateAsync(threadId);
  }, [enabled, mutateAsync, threadId]);

  const schedule = useCallback(() => {
    if (!threadId || !enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flush();
    }, MARK_READ_DEBOUNCE_MS);
  }, [enabled, flush, threadId]);

  useEffect(() => {
    if (lastThreadRef.current !== threadId) {
      lastThreadRef.current = threadId;
      lastFlushAtRef.current = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [threadId]);

  return { schedule, flush };
}
