/**
 * useKeyboardInset — высота «перекрытия» клавиатурой для padding / translateY.
 *
 * Возвращает `SharedValue<number>` (Reanimated): обновления идут с UI-потока через `withTiming`,
 * без лишней нагрузки на JS thread от `Animated.Value` + bridge.
 *
 * - iOS: keyboardWillChangeFrame
 * - Android: keyboardDidShow / keyboardDidHide
 */

import { useEffect, useRef } from "react";
import { Dimensions, Keyboard, Platform } from "react-native";
import { Easing, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

export interface KeyboardInsetOptions {
  tabBarHeight?: number;
  gap?: number;
  bottomInset?: number;
  /**
   * Устарело: раньше переключало `useNativeDriver` у RN Animated.
   * Оставлено для обратной совместимости вызовов; значение игнорируется.
   */
  useNativeDriver?: boolean;
  enabled?: boolean;
  onKeyboardChange?: (keyboardTop: number, keyboardHeight: number) => void;
}

/** Android often sends `duration: 0` on `keyboardDid*` — `withTiming` would snap without a positive ms. */
function resolveKeyboardAnimationDuration(eventDuration: number | undefined, fallback: number): number {
  if (eventDuration != null && eventDuration > 80) {
    return eventDuration;
  }
  return fallback;
}

/**
 * When `adjustResize` already shrank the activity window, manual translateY would double-lift
 * (Expo Go). Production RN `Modal` dialogs usually do not resize — then overlap must be applied.
 */
function resolveAndroidKeyboardOverlap(
  windowHeight: number,
  keyboardTop: number,
  keyboardHeight: number,
  baselineWindowHeight: number,
): number {
  if (keyboardHeight <= 0) return 0;

  const screenHeight = Dimensions.get("screen").height;
  let overlapFromCoords = Math.max(0, windowHeight - keyboardTop);

  // Some devices report screenY=0 or other bad values → overlap ≈ full window → sheet flies to top.
  if (keyboardTop < windowHeight * 0.35 || overlapFromCoords > keyboardHeight * 1.15) {
    overlapFromCoords = Math.max(0, screenHeight - keyboardTop - (screenHeight - windowHeight));
    if (overlapFromCoords > keyboardHeight * 1.15 || overlapFromCoords <= 0) {
      overlapFromCoords = keyboardHeight;
    }
  }

  const overlap = Math.min(overlapFromCoords, keyboardHeight);
  const shrunkBy = baselineWindowHeight - windowHeight;
  if (shrunkBy >= keyboardHeight * 0.75) {
    return 0;
  }
  return overlap;
}

export function useKeyboardInset(options: KeyboardInsetOptions = {}): SharedValue<number> {
  const {
    tabBarHeight = 0,
    gap = Platform.OS === "android" ? 24 : 16,
    bottomInset = 0,
    enabled = true,
    onKeyboardChange,
  } = options;

  const keyboardInset = useSharedValue(0);
  const onKeyboardChangeRef = useRef(onKeyboardChange ?? null);
  onKeyboardChangeRef.current = onKeyboardChange ?? null;
  const baselineWindowHeightRef = useRef(Dimensions.get("window").height);

  useEffect(() => {
    const fallbackMs = Platform.OS === "android" ? 280 : 250;
    let androidRecalcTimer: ReturnType<typeof setTimeout> | null = null;

    const animate = (toValue: number, duration: number) => {
      if (!enabled) return;
      keyboardInset.value = withTiming(toValue, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    };

    const applyKeyboardShow = (event: {
      endCoordinates: { height: number; screenY?: number };
      duration?: number;
    }) => {
      const windowHeight = Dimensions.get("window").height;
      const keyboardHeight = event.endCoordinates.height;
      const keyboardTop = event.endCoordinates.screenY ?? windowHeight - keyboardHeight;
      const rawOverlap =
        Platform.OS === "android"
          ? resolveAndroidKeyboardOverlap(
              windowHeight,
              keyboardTop,
              keyboardHeight,
              baselineWindowHeightRef.current,
            )
          : Math.max(0, windowHeight - keyboardTop);
      const inset = Math.max(0, rawOverlap - tabBarHeight - bottomInset + gap);
      const durationMs = resolveKeyboardAnimationDuration(event.duration, fallbackMs);
      animate(inset, durationMs);
      onKeyboardChangeRef.current?.(keyboardTop, rawOverlap);
    };

    const onShow = (event: {
      endCoordinates: { height: number; screenY?: number };
      duration?: number;
    }) => {
      applyKeyboardShow(event);
      if (Platform.OS === "android") {
        if (androidRecalcTimer) clearTimeout(androidRecalcTimer);
        androidRecalcTimer = setTimeout(() => applyKeyboardShow(event), 100);
      }
    };

    const onHide = (event?: { duration?: number }) => {
      if (androidRecalcTimer) {
        clearTimeout(androidRecalcTimer);
        androidRecalcTimer = null;
      }
      const durationMs = resolveKeyboardAnimationDuration(event?.duration, fallbackMs);
      animate(0, durationMs);
      baselineWindowHeightRef.current = Dimensions.get("window").height;
      const windowHeight = Dimensions.get("window").height;
      onKeyboardChangeRef.current?.(windowHeight, 0);
    };

    const showEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      if (androidRecalcTimer) clearTimeout(androidRecalcTimer);
      showSub.remove();
      hideSub.remove();
    };
  }, [bottomInset, enabled, gap, keyboardInset, tabBarHeight]);

  return keyboardInset;
}
