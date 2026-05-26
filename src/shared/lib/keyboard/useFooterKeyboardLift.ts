/**
 * iOS: подъём до клавиатуры по measureInWindow (без withTiming — кадр в кадр с keyboardWillChangeFrame).
 * Значение `lift` можно применить к футеру (`translateY: -lift`) или ко всему контенту страницы
 * (список + composer), чтобы сообщения и футер двигались синхронно с клавиатурой.
 * Android: используйте useKeyboardInset + paddingBottom на контейнере.
 */

import { useCallback, useEffect, useRef } from "react";
import type { View } from "react-native";
import { Dimensions, Keyboard, Platform } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

export type FooterKeyboardLiftOptions = {
  gap?: number;
  enabled?: boolean;
  /** While > 0, ignore transient keyboard hide frames (composer icon taps). */
  holdDuringInteraction?: SharedValue<number>;
  /** While > 0, keep lift while native picker is presented (photo library, etc.). */
  holdDuringPicker?: SharedValue<number>;
};

export type FooterKeyboardLiftResult = {
  /** Пиксели подъёма: `transform: [{ translateY: -lift }]` на контейнере контента или футере. */
  lift: SharedValue<number>;
  recalculate: () => void;
};

export function useFooterKeyboardLift(
  getFooterAnchor: () => View | null,
  options: FooterKeyboardLiftOptions = {},
): FooterKeyboardLiftResult {
  const { gap = 0, enabled = true, holdDuringInteraction, holdDuringPicker } = options;
  const lift = useSharedValue(0);
  const getFooterAnchorRef = useRef(getFooterAnchor);
  getFooterAnchorRef.current = getFooterAnchor;
  const lastKeyboardTopRef = useRef<number | null>(null);

  const setLift = useCallback(
    (value: number) => {
      if (!enabled) return;
      lift.value = value;
    },
    [enabled, lift],
  );

  const measureLift = useCallback(
    (keyboardTop: number, deferLayout = false) => {
      const anchor = getFooterAnchorRef.current();
      if (!anchor || typeof anchor.measureInWindow !== "function") {
        return;
      }

      const runMeasure = () => {
        anchor.measureInWindow((_x, y, _w, h) => {
          setLift(Math.max(0, y + h + gap - keyboardTop));
        });
      };

      if (deferLayout) {
        requestAnimationFrame(() => {
          requestAnimationFrame(runMeasure);
        });
      } else {
        runMeasure();
      }
    },
    [gap, setLift],
  );

  const shouldHoldLift = useCallback(() => {
    if (holdDuringPicker && holdDuringPicker.value > 0) return true;
    if (holdDuringInteraction && holdDuringInteraction.value > 0) return true;
    return false;
  }, [holdDuringInteraction, holdDuringPicker]);

  const recalculate = useCallback(() => {
    const keyboardTop = lastKeyboardTopRef.current;
    if (keyboardTop == null) return;
    measureLift(keyboardTop, true);
  }, [measureLift]);

  useEffect(() => {
    if (Platform.OS !== "ios" || !enabled) {
      return undefined;
    }

    const applyFrame = (event: {
      endCoordinates: { height: number; screenY?: number };
    }) => {
      const keyboardHeight = event.endCoordinates.height;
      const windowHeight = Dimensions.get("window").height;
      const keyboardTop = event.endCoordinates.screenY ?? windowHeight - keyboardHeight;

      if (keyboardHeight < 1) {
        if (shouldHoldLift()) {
          return;
        }
        lastKeyboardTopRef.current = null;
        setLift(0);
        return;
      }

      lastKeyboardTopRef.current = keyboardTop;
      measureLift(keyboardTop, false);
    };

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      if (shouldHoldLift()) {
        return;
      }
      lastKeyboardTopRef.current = null;
      setLift(0);
    });

    const changeSub = Keyboard.addListener("keyboardWillChangeFrame", applyFrame);
    return () => {
      changeSub.remove();
      hideSub.remove();
    };
  }, [enabled, measureLift, setLift, shouldHoldLift]);

  return { lift, recalculate };
}
