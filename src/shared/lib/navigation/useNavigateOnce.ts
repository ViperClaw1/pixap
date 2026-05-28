import { useCallback, useRef } from "react";

const DEFAULT_RESET_MS = 400;

/** Prevents double navigation from rapid taps on Android. */
export function useNavigateOnce(resetMs = DEFAULT_RESET_MS) {
  const navigatingRef = useRef(false);

  return useCallback(
    (action: () => void) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      action();
      setTimeout(() => {
        navigatingRef.current = false;
      }, resetMs);
    },
    [resetMs],
  );
}
