import { useCallback, useRef, useState } from "react";
import { InteractionManager } from "react-native";

export function useExpandVisibleBatch() {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingRef = useRef(false);

  const expand = useCallback((increment: () => void) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoadingMore(true);
    requestAnimationFrame(() => {
      increment();
      InteractionManager.runAfterInteractions(() => {
        loadingRef.current = false;
        setIsLoadingMore(false);
      });
    });
  }, []);

  return { isLoadingMore, expand };
}
