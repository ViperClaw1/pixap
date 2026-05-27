/**
 * useKeyboardInset — высота «перекрытия» клавиатурой для padding / translateY.
 *
 * iOS: `useAnimatedKeyboard` (UI-поток). Android: `Keyboard.addListener` (корректнее с adjustResize).
 */

import { useEffect, useRef } from "react";
import { Dimensions, Keyboard, Platform } from "react-native";
import {
  Easing,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

export interface KeyboardInsetOptions {
  tabBarHeight?: number;
  /**
   * gap > 0: отступ между клавиатурой и контентом (ScrollView-формы).
   * gap = 0: вплотную — sticky-footer (чат, комментарии).
   */
  gap?: number;
  bottomInset?: number;
  /**
   * false — activity resize (adjustResize): не дублировать подъём.
   * true  — модал / overlay: окно не сжимается, нужен полный inset.
   */
  ignoreWindowResize?: boolean;
  /**
   * @deprecated Игнорируется; оставлено для совместимости вызовов.
   */
  useNativeDriver?: boolean;
  enabled?: boolean;
  /**
   * true  → useAnimatedKeyboard (нативно-синхронно).
   * false → Keyboard.addListener fallback.
   * @default true
   */
  native?: boolean;
  onKeyboardChange?: (keyboardTop: number, keyboardHeight: number) => void;
}

/** Android often sends `duration: 0` on `keyboardDid*` — snap without a positive ms. */
function resolveKeyboardAnimationDuration(eventDuration: number | undefined, fallback: number): number {
  if (eventDuration != null && eventDuration > 80) {
    return eventDuration;
  }
  return fallback;
}

function resolveAndroidKeyboardOverlap(
  windowHeight: number,
  keyboardTop: number,
  keyboardHeight: number,
  baselineWindowHeight: number,
  ignoreWindowResize: boolean,
): number {
  if (keyboardHeight <= 0) return 0;

  const screenHeight = Dimensions.get("screen").height;
  let overlapFromCoords = Math.max(0, windowHeight - keyboardTop);

  if (keyboardTop < windowHeight * 0.35 || overlapFromCoords > keyboardHeight * 1.15) {
    overlapFromCoords = Math.max(0, screenHeight - keyboardTop - (screenHeight - windowHeight));
    if (overlapFromCoords > keyboardHeight * 1.15 || overlapFromCoords <= 0) {
      overlapFromCoords = keyboardHeight;
    }
  }

  let overlap = Math.min(overlapFromCoords, keyboardHeight);

  if (!ignoreWindowResize) {
    const shrunkBy = baselineWindowHeight - windowHeight;
    if (shrunkBy > 48) {
      return Math.max(0, Math.min(overlap, keyboardHeight) - shrunkBy);
    }
  }

  if (ignoreWindowResize && overlap < keyboardHeight * 0.35) {
    overlap = keyboardHeight;
  }

  return overlap;
}

function computeInsetFromOverlap(
  rawOverlap: number,
  tabBarHeight: number,
  bottomInset: number,
  gap: number,
): number {
  "worklet";
  return Math.max(0, rawOverlap - tabBarHeight - bottomInset + gap);
}

export function useKeyboardInset(options: KeyboardInsetOptions = {}): SharedValue<number> {
  const {
    tabBarHeight = 0,
    gap = 0,
    bottomInset = 0,
    ignoreWindowResize = false,
    enabled = true,
    native = Platform.OS === "ios",
    onKeyboardChange,
  } = options;

  const keyboard = useAnimatedKeyboard({ isStatusBarTranslucentAndroid: true });
  const inset = useSharedValue(0);
  const fallbackInset = useSharedValue(0);
  const windowHeight = useSharedValue(Dimensions.get("window").height);
  const baselineWindowHeight = useSharedValue(Dimensions.get("window").height);

  const isAndroid = Platform.OS === "android";

  const onKeyboardChangeRef = useRef(onKeyboardChange);
  const baselineWindowHeightRef = useRef(Dimensions.get("window").height);

  useEffect(() => {
    onKeyboardChangeRef.current = onKeyboardChange;
  }, [onKeyboardChange]);

  const notifyKeyboardChange = (keyboardTop: number, keyboardHeight: number) => {
    onKeyboardChangeRef.current?.(keyboardTop, keyboardHeight);
  };

  useEffect(() => {
    if (!native) return undefined;

    const syncWindow = ({ window }: { window: { height: number } }) => {
      windowHeight.value = window.height;
    };

    windowHeight.value = Dimensions.get("window").height;
    baselineWindowHeight.value = Dimensions.get("window").height;
    baselineWindowHeightRef.current = Dimensions.get("window").height;

    const dimSub = Dimensions.addEventListener("change", syncWindow);
    return () => dimSub.remove();
  }, [baselineWindowHeight, native, windowHeight]);

  useAnimatedReaction(
    () => {
      "worklet";
      if (!enabled) return 0;

      if (!native) {
        return fallbackInset.value;
      }

      let raw = keyboard.height.value;
      const shrunkBy = Math.max(0, baselineWindowHeight.value - windowHeight.value);

      if (isAndroid) {
        if (!ignoreWindowResize) {
          if (shrunkBy > 48) {
            raw = Math.max(0, raw - shrunkBy);
          }
        } else if (shrunkBy > 48) {
          raw = Math.max(raw, shrunkBy);
        }
      }

      return Math.max(0, raw - tabBarHeight - bottomInset + gap);
    },
    (value, prev) => {
      "worklet";
      if (value === prev) return;
      inset.value = value;
    },
    [bottomInset, enabled, gap, ignoreWindowResize, isAndroid, native, tabBarHeight],
  );

  useAnimatedReaction(
    () => (!native && enabled ? fallbackInset.value : -1),
    (value, prev) => {
      "worklet";
      if (!native && enabled && value >= 0 && value !== prev) {
        inset.value = value;
      }
    },
    [enabled, native],
  );

  useAnimatedReaction(
    () => (native && enabled ? keyboard.height.value : -1),
    (height, prev) => {
      "worklet";
      if (!native || !enabled || height < 0) return;
      if (height === 0 && prev != null && prev > 0) {
        baselineWindowHeight.value = windowHeight.value;
      }
      if (prev == null || Math.abs(height - (prev ?? 0)) >= 1) {
        runOnJS(notifyKeyboardChange)(windowHeight.value - height, height);
      }
    },
    [enabled, native],
  );

  useEffect(() => {
    if (native) {
      if (!enabled) {
        inset.value = 0;
        fallbackInset.value = 0;
      }
      return undefined;
    }

    if (!enabled) {
      inset.value = 0;
      fallbackInset.value = 0;
      return undefined;
    }

    const fallbackMs = Platform.OS === "android" ? 280 : 250;

    const setInsetAnimated = (toValue: number, duration: number) => {
      if (!enabled) return;
      fallbackInset.value = withTiming(toValue, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      inset.value = fallbackInset.value;
    };

    const applyKeyboardFrame = (
      event: {
        endCoordinates: { height: number; screenY?: number };
        duration?: number;
      },
      frameOptions?: { animate?: boolean },
    ) => {
      const wh = Dimensions.get("window").height;
      const keyboardHeight = event.endCoordinates.height;
      const keyboardTop = event.endCoordinates.screenY ?? wh - keyboardHeight;
      const rawOverlap =
        Platform.OS === "android"
          ? resolveAndroidKeyboardOverlap(
              wh,
              keyboardTop,
              keyboardHeight,
              baselineWindowHeightRef.current,
              ignoreWindowResize,
            )
          : Math.max(0, wh - keyboardTop);
      const nextInset = computeInsetFromOverlap(rawOverlap, tabBarHeight, bottomInset, gap);

      if (!enabled) return;

      if (Platform.OS === "ios" || frameOptions?.animate === false) {
        fallbackInset.value = nextInset;
        inset.value = nextInset;
      } else {
        const durationMs = resolveKeyboardAnimationDuration(event.duration, fallbackMs);
        setInsetAnimated(nextInset, durationMs);
      }

      onKeyboardChangeRef.current?.(keyboardTop, rawOverlap);
    };

    const onAndroidShow = (event: {
      endCoordinates: { height: number; screenY?: number };
      duration?: number;
    }) => {
      applyKeyboardFrame(event, { animate: false });
    };

    const onAndroidHide = () => {
      fallbackInset.value = 0;
      inset.value = 0;
      baselineWindowHeightRef.current = Dimensions.get("window").height;
      const wh = Dimensions.get("window").height;
      onKeyboardChangeRef.current?.(wh, 0);
    };

    if (Platform.OS === "ios") {
      const changeSub = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
        applyKeyboardFrame(event, { animate: false });
      });
      return () => {
        changeSub.remove();
      };
    }

    baselineWindowHeightRef.current = Dimensions.get("window").height;

    const showSub = Keyboard.addListener("keyboardDidShow", onAndroidShow);
    const hideSub = Keyboard.addListener("keyboardDidHide", onAndroidHide);

    const applyAndroidWindowResize = ({ window }: { window: { height: number } }) => {
      if (!enabled || !ignoreWindowResize) return;
      const baseline = baselineWindowHeightRef.current;
      const rawOverlap = Math.max(0, baseline - window.height);
      if (rawOverlap <= 48) {
        if (rawOverlap === 0) {
          fallbackInset.value = 0;
          inset.value = 0;
          baselineWindowHeightRef.current = window.height;
          onKeyboardChangeRef.current?.(window.height, 0);
        }
        return;
      }
      const nextInset = computeInsetFromOverlap(rawOverlap, tabBarHeight, bottomInset, gap);
      fallbackInset.value = nextInset;
      inset.value = nextInset;
      onKeyboardChangeRef.current?.(window.height, rawOverlap);
    };

    const dimSub = ignoreWindowResize ? Dimensions.addEventListener("change", applyAndroidWindowResize) : null;

    return () => {
      showSub.remove();
      hideSub.remove();
      dimSub?.remove();
    };
  }, [bottomInset, enabled, fallbackInset, gap, ignoreWindowResize, inset, native, tabBarHeight]);

  return inset;
}
