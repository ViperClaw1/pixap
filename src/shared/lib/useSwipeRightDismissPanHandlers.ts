import { useMemo, useRef } from "react";
import { PanResponder } from "react-native";

/**
 * Свайп вправо вызывает `onDismiss` (например закрытие оверлея архива без `navigation.goBack`).
 * Работает на iOS и Android: для встроенного оверлея нет нативного edge-back.
 */
export function useSwipeRightDismissPanHandlers(onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  return useMemo(() => {
    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderRelease: (_e, g) => {
        const swipeRight = g.dx > 48 && Math.abs(g.dx) > Math.abs(g.dy) * 1.05;
        if (swipeRight) onDismissRef.current();
      },
    });
    return panResponder.panHandlers;
  }, []);
}
