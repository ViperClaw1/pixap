/**
 * Дополнительный inset только если нижний край сфокусированного TextInput
 * пересекается с клавиатурой (плюс gap).
 *
 * iOS: синхронно с `keyboardWillChangeFrame`, без `withTiming`.
 * Android: `keyboardDidShow` / `keyboardDidHide`, анимация через `withTiming`.
 */

import { useCallback, useEffect, useRef } from "react";
import type { ElementRef } from "react";
import { Dimensions, Keyboard, Platform, TextInput } from "react-native";
import { Easing, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

export interface UseFocusedOverlapKeyboardInsetOptions {
  gap: number;
  getFocusedInput: () => ElementRef<typeof TextInput> | null;
  enabled?: boolean;
  /**
   * When inset is applied via `translateY`, `measureInWindow` includes the lift —
   * add the last applied inset back to compute the natural overlap.
   */
  compensateAppliedLift?: boolean;
  onKeyboardFrame?: (keyboardTop: number, keyboardHeight: number) => void;
  onKeyboardChange?: (keyboardTop: number, keyboardHeight: number) => void;
}

export interface FocusedOverlapKeyboardInsetResult {
  extraInset: SharedValue<number>;
  recalculate: () => void;
}

export function useFocusedOverlapKeyboardInset({
  gap,
  getFocusedInput,
  enabled = true,
  compensateAppliedLift = false,
  onKeyboardFrame,
  onKeyboardChange,
}: UseFocusedOverlapKeyboardInsetOptions): FocusedOverlapKeyboardInsetResult {
  const extraInset = useSharedValue(0);
  const getFocusedInputRef = useRef(getFocusedInput);
  getFocusedInputRef.current = getFocusedInput;
  const onKeyboardFrameRef = useRef(onKeyboardFrame ?? null);
  onKeyboardFrameRef.current = onKeyboardFrame ?? null;
  const onKeyboardChangeRef = useRef(onKeyboardChange ?? null);
  onKeyboardChangeRef.current = onKeyboardChange ?? null;

  const lastFrameRef = useRef<{
    keyboardTop: number;
    rawOverlap: number;
    duration?: number;
  } | null>(null);
  const lastAppliedOverlapRef = useRef(0);
  const lastFocusedInputRef = useRef<ElementRef<typeof TextInput> | null>(null);
  const compensateAppliedLiftRef = useRef(compensateAppliedLift);
  compensateAppliedLiftRef.current = compensateAppliedLift;

  const resolveOverlap = useCallback((measuredOverlap: number) => {
    if (!compensateAppliedLiftRef.current) return measuredOverlap;
    return measuredOverlap + lastAppliedOverlapRef.current;
  }, []);

  const resetAppliedLift = useCallback(() => {
    if (!compensateAppliedLiftRef.current) return;
    lastAppliedOverlapRef.current = 0;
    extraInset.value = 0;
  }, [extraInset]);

  const measureCorrectedOverlap = useCallback(
    (keyboardTop: number, onDone: (overlap: number) => void) => {
      const input = getFocusedInputRef.current();
      if (!input || typeof input.measureInWindow !== "function") {
        lastFocusedInputRef.current = null;
        if (compensateAppliedLiftRef.current) {
          resetAppliedLift();
        }
        onDone(0);
        return;
      }

      if (input !== lastFocusedInputRef.current) {
        lastFocusedInputRef.current = input;
        if (compensateAppliedLiftRef.current) {
          resetAppliedLift();
          if (Platform.OS === "ios") {
            requestAnimationFrame(() => {
              const frameTop = lastFrameRef.current?.keyboardTop ?? keyboardTop;
              input.measureInWindow((_x, y, _w, h) => {
                const measuredOverlap = Math.max(0, y + h + gap - frameTop);
                onDone(resolveOverlap(measuredOverlap));
              });
            });
            return;
          }
        }
      }

      input.measureInWindow((_x, y, _w, h) => {
        const measuredOverlap = Math.max(0, y + h + gap - keyboardTop);
        onDone(resolveOverlap(measuredOverlap));
      });
    },
    [gap, resetAppliedLift, resolveOverlap],
  );

  const animateTo = useCallback(
    (overlap: number, duration?: number, options?: { animate?: boolean }) => {
      if (!enabled) return;
      lastAppliedOverlapRef.current = overlap;
      if (Platform.OS === "ios" || options?.animate === false) {
        extraInset.value = overlap;
        return;
      }
      extraInset.value = withTiming(overlap, {
        duration: duration ?? 250,
        easing: Easing.out(Easing.cubic),
      });
    },
    [enabled, extraInset],
  );

  const applyMeasuredInset = useCallback(
    (keyboardTop: number, rawOverlap: number, duration?: number, animate = true) => {
      const finish = (overlap: number) => {
        animateTo(overlap, duration, { animate });
        onKeyboardChangeRef.current?.(keyboardTop, rawOverlap);
      };

      const runMeasure = () => measureCorrectedOverlap(keyboardTop, finish);

      // iOS: keyboardWillChangeFrame fires every animation frame — measure synchronously.
      if (Platform.OS === "ios") {
        runMeasure();
        return;
      }

      runMeasure();
    },
    [animateTo, measureCorrectedOverlap],
  );

  const recalculate = useCallback(() => {
    const last = lastFrameRef.current;
    if (!last || last.rawOverlap <= 1) return;

    const runMeasure = () => {
      measureCorrectedOverlap(last.keyboardTop, (overlap) => {
        animateTo(overlap, last.duration ?? 200, { animate: Platform.OS !== "ios" });
      });
    };

    if (Platform.OS === "ios" && compensateAppliedLiftRef.current) {
      resetAppliedLift();
      requestAnimationFrame(runMeasure);
      return;
    }

    runMeasure();
  }, [animateTo, measureCorrectedOverlap, resetAppliedLift]);

  useEffect(() => {
    const windowHeight = () => Dimensions.get("window").height;

    const handleShow = (event: {
      endCoordinates: { height: number; screenY?: number };
      duration?: number;
    }) => {
      const wh = windowHeight();
      const h = event.endCoordinates.height;
      const keyboardTop = event.endCoordinates.screenY ?? wh - h;
      const rawOverlap = Math.max(0, wh - keyboardTop);

      if (h < 1 || rawOverlap < 1) {
        lastFrameRef.current = null;
        onKeyboardFrameRef.current?.(wh, 0);
        animateTo(0, event.duration);
        onKeyboardChangeRef.current?.(wh, 0);
        return;
      }

      lastFrameRef.current = {
        keyboardTop,
        rawOverlap,
        duration: event.duration,
      };
      onKeyboardFrameRef.current?.(keyboardTop, rawOverlap);
      applyMeasuredInset(keyboardTop, rawOverlap, event.duration);
    };

    const handleHide = (event?: { duration?: number }) => {
      lastFrameRef.current = null;
      lastFocusedInputRef.current = null;
      lastAppliedOverlapRef.current = 0;
      const wh = windowHeight();
      onKeyboardFrameRef.current?.(wh, 0);
      animateTo(0, event?.duration);
      onKeyboardChangeRef.current?.(wh, 0);
    };

    if (Platform.OS === "ios") {
      const changeSub = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
        const wh = windowHeight();
        const h = event.endCoordinates.height;
        const keyboardTop = event.endCoordinates.screenY ?? wh - h;
        const rawOverlap = Math.max(0, wh - keyboardTop);

        if (h < 1 || rawOverlap < 1) {
          lastFrameRef.current = null;
          lastFocusedInputRef.current = null;
          onKeyboardFrameRef.current?.(wh, 0);
          extraInset.value = 0;
          lastAppliedOverlapRef.current = 0;
          onKeyboardChangeRef.current?.(wh, 0);
          return;
        }

        lastFrameRef.current = {
          keyboardTop,
          rawOverlap,
          duration: event.duration,
        };
        onKeyboardFrameRef.current?.(keyboardTop, rawOverlap);
        applyMeasuredInset(keyboardTop, rawOverlap, event.duration, false);
      });

      return () => {
        changeSub.remove();
      };
    }

    const showSub = Keyboard.addListener("keyboardDidShow", handleShow);
    const hideSub = Keyboard.addListener("keyboardDidHide", handleHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [animateTo, applyMeasuredInset, extraInset]);

  return { extraInset, recalculate };
}
