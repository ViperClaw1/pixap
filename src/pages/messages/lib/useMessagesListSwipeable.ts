import { useCallback, useRef } from "react";
import type { Swipeable } from "react-native-gesture-handler";

export function useMessagesListSwipeable() {
  const openRowRef = useRef<Swipeable | null>(null);

  const handleSwipeableOpen = useCallback((_: "left" | "right", row: Swipeable) => {
    if (openRowRef.current && openRowRef.current !== row) {
      openRowRef.current.close();
    }
    openRowRef.current = row;
  }, []);

  const handleSwipeableClose = useCallback(() => {
    openRowRef.current = null;
  }, []);

  const closeOpenSwipeable = useCallback(() => {
    openRowRef.current?.close();
    openRowRef.current = null;
  }, []);

  return { handleSwipeableOpen, handleSwipeableClose, closeOpenSwipeable };
}
