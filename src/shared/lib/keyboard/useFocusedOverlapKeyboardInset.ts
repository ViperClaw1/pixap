/**
 * Дополнительный padding снизу только если нижний край сфокусированного
 * TextInput пересекается с клавиатурой (плюс gap). Синхронизирует duration
 * с keyboardWillChangeFrame / keyboardDidShow.
 */

import { useCallback, useEffect, useRef } from "react";
import type { ElementRef } from "react";
import { Animated, Dimensions, Keyboard, Platform, TextInput } from "react-native";

export interface UseFocusedOverlapKeyboardInsetOptions {
  gap: number;
  getFocusedInput: () => ElementRef<typeof TextInput> | null;
  enabled?: boolean;
  /** Сразу при событии клавиатуры (до measure) — обновление ref’ов экрана. */
  onKeyboardFrame?: (keyboardTop: number, keyboardHeight: number) => void;
  /** После measure — скролл к полю и т.п. */
  onKeyboardChange?: (keyboardTop: number, keyboardHeight: number) => void;
}

export interface FocusedOverlapKeyboardInsetResult {
  /** Добавить к базовому paddingBottom: 0, если поле не перекрыто. */
  extraInset: Animated.Value;
  /** Клавиатура уже открыта — пересчитать overlap (смена фокуса между полями). */
  recalculate: () => void;
}

export function useFocusedOverlapKeyboardInset({
  gap,
  getFocusedInput,
  enabled = true,
  onKeyboardFrame,
  onKeyboardChange,
}: UseFocusedOverlapKeyboardInsetOptions): FocusedOverlapKeyboardInsetResult {
  const extraInset = useRef(new Animated.Value(0)).current;
  const getFocusedInputRef = useRef(getFocusedInput);
  getFocusedInputRef.current = getFocusedInput;
  const onKeyboardFrameRef = useRef(onKeyboardFrame);
  onKeyboardFrameRef.current = onKeyboardFrame;
  const onKeyboardChangeRef = useRef(onKeyboardChange);
  onKeyboardChangeRef.current = onKeyboardChange;

  const lastFrameRef = useRef<{
    keyboardTop: number;
    rawOverlap: number;
    duration?: number;
  } | null>(null);

  const measureOverlap = useCallback(
    (keyboardTop: number, onDone: (overlap: number) => void) => {
      const input = getFocusedInputRef.current();
      if (!input || typeof input.measureInWindow !== "function") {
        onDone(0);
        return;
      }
      input.measureInWindow((_x, y, _w, h) => {
        const overlap = Math.max(0, y + h + gap - keyboardTop);
        onDone(overlap);
      });
    },
    [gap],
  );

  const animateTo = useCallback(
    (overlap: number, duration?: number) => {
      if (!enabled) return;
      Animated.timing(extraInset, {
        toValue: overlap,
        duration: duration ?? 250,
        useNativeDriver: false,
      }).start();
    },
    [enabled, extraInset],
  );

  const applyMeasuredInset = useCallback(
    (keyboardTop: number, rawOverlap: number, duration?: number) => {
      const finish = (overlap: number) => {
        animateTo(overlap, duration);
        onKeyboardChangeRef.current?.(keyboardTop, rawOverlap);
      };

      const runMeasure = () => measureOverlap(keyboardTop, finish);

      if (Platform.OS === "ios") {
        requestAnimationFrame(() => {
          requestAnimationFrame(runMeasure);
        });
      } else {
        runMeasure();
      }
    },
    [animateTo, measureOverlap],
  );

  const recalculate = useCallback(() => {
    const last = lastFrameRef.current;
    if (!last || last.rawOverlap <= 1) return;
    measureOverlap(last.keyboardTop, (overlap) => {
      animateTo(overlap, last.duration ?? 200);
    });
  }, [animateTo, measureOverlap]);

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
      const wh = windowHeight();
      onKeyboardFrameRef.current?.(wh, 0);
      animateTo(0, event?.duration);
      onKeyboardChangeRef.current?.(wh, 0);
    };

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, handleShow);
    const hideSub = Keyboard.addListener(hideEvent, handleHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [animateTo, applyMeasuredInset]);

  return { extraInset, recalculate };
}
