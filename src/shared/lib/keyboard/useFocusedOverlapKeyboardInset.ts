/**
 * Дополнительный padding снизу только если нижний край сфокусированного
 * TextInput пересекается с клавиатурой (плюс gap).
 */

import { useCallback, useEffect, useRef } from "react";
import type { ElementRef } from "react";
import { Dimensions, Keyboard, Platform, TextInput, type View } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

type MeasurableNode = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

export interface UseFocusedOverlapKeyboardInsetOptions {
  gap: number;
  getFocusedInput: () => ElementRef<typeof TextInput> | null;
  /** When set, measures this node (e.g. full composer footer) instead of the focused input box. */
  getMeasureTarget?: () => ElementRef<typeof View> | ElementRef<typeof TextInput> | null;
  enabled?: boolean;
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
  getMeasureTarget,
  enabled = true,
  onKeyboardFrame,
  onKeyboardChange,
}: UseFocusedOverlapKeyboardInsetOptions): FocusedOverlapKeyboardInsetResult {
  const extraInset = useSharedValue(0);
  const getFocusedInputRef = useRef(getFocusedInput);
  const getMeasureTargetRef = useRef(getMeasureTarget);
  const onKeyboardFrameRef = useRef(onKeyboardFrame);
  const onKeyboardChangeRef = useRef(onKeyboardChange);

  useEffect(() => {
    getFocusedInputRef.current = getFocusedInput;
  }, [getFocusedInput]);

  useEffect(() => {
    getMeasureTargetRef.current = getMeasureTarget;
  }, [getMeasureTarget]);

  useEffect(() => {
    onKeyboardFrameRef.current = onKeyboardFrame;
  }, [onKeyboardFrame]);

  useEffect(() => {
    onKeyboardChangeRef.current = onKeyboardChange;
  }, [onKeyboardChange]);

  const lastFrameRef = useRef<{
    keyboardTop: number;
    rawOverlap: number;
    duration?: number;
  } | null>(null);
  const lastAppliedOverlapRef = useRef(0);

  const measureOverlap = useCallback(
    (keyboardTop: number, onDone: (overlap: number) => void) => {
      const target = getMeasureTargetRef.current?.() ?? getFocusedInputRef.current();
      if (!target || typeof (target as MeasurableNode).measureInWindow !== "function") {
        onDone(0);
        return;
      }
      (target as MeasurableNode).measureInWindow((_x, y, _w, h) => {
        const overlap = Math.max(0, y + h + gap - keyboardTop);
        onDone(overlap);
      });
    },
    [gap],
  );

  const applyOverlap = useCallback(
    (overlap: number, keyboardTop: number, rawOverlap: number) => {
      if (!enabled) return;
      lastAppliedOverlapRef.current = overlap;
      extraInset.value = overlap;
      onKeyboardChangeRef.current?.(keyboardTop, rawOverlap);
    },
    [enabled, extraInset],
  );

  const applyMeasuredInset = useCallback(
    (keyboardTop: number, rawOverlap: number) => {
      const finish = (overlap: number) => {
        applyOverlap(overlap, keyboardTop, rawOverlap);
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
    [applyOverlap, measureOverlap],
  );

  const recalculate = useCallback(() => {
    const last = lastFrameRef.current;
    if (!last || last.rawOverlap <= 1) return;
    measureOverlap(last.keyboardTop, (measuredOverlap) => {
      const correctedOverlap = measuredOverlap + lastAppliedOverlapRef.current;
      applyOverlap(correctedOverlap, last.keyboardTop, last.rawOverlap);
    });
  }, [applyOverlap, measureOverlap]);

  useEffect(() => {
    if (!enabled) {
      extraInset.value = 0;
      return undefined;
    }

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
        applyOverlap(0, wh, 0);
        return;
      }

      lastFrameRef.current = {
        keyboardTop,
        rawOverlap,
        duration: event.duration,
      };
      onKeyboardFrameRef.current?.(keyboardTop, rawOverlap);
      applyMeasuredInset(keyboardTop, rawOverlap);
    };

    const handleHide = () => {
      lastFrameRef.current = null;
      lastAppliedOverlapRef.current = 0;
      const wh = windowHeight();
      onKeyboardFrameRef.current?.(wh, 0);
      applyOverlap(0, wh, 0);
    };

    if (Platform.OS === "ios") {
      const changeSub = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
        const wh = windowHeight();
        const h = event.endCoordinates.height;
        const keyboardTop = event.endCoordinates.screenY ?? wh - h;
        const rawOverlap = Math.max(0, wh - keyboardTop);

        if (h < 1 || rawOverlap < 1) {
          lastFrameRef.current = null;
          onKeyboardFrameRef.current?.(wh, 0);
          extraInset.value = 0;
          onKeyboardChangeRef.current?.(wh, 0);
          return;
        }

        lastFrameRef.current = {
          keyboardTop,
          rawOverlap,
          duration: event.duration,
        };
        onKeyboardFrameRef.current?.(keyboardTop, rawOverlap);
        applyMeasuredInset(keyboardTop, rawOverlap);
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
  }, [applyMeasuredInset, applyOverlap, enabled, extraInset]);

  return { extraInset, recalculate };
}
