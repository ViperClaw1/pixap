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

  useEffect(() => {
    const fallbackMs = Platform.OS === "android" ? 280 : 250;

    const animate = (toValue: number, duration: number) => {
      if (!enabled) return;
      keyboardInset.value = withTiming(toValue, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    };

    const onShow = (event: {
      endCoordinates: { height: number; screenY?: number };
      duration?: number;
    }) => {
      const windowHeight = Dimensions.get("window").height;
      const keyboardTop = event.endCoordinates.screenY ?? windowHeight - event.endCoordinates.height;
      const rawOverlap = Math.max(0, windowHeight - keyboardTop);
      const inset = Math.max(0, rawOverlap - tabBarHeight - bottomInset + gap);
      const durationMs = resolveKeyboardAnimationDuration(event.duration, fallbackMs);
      animate(inset, durationMs);
      onKeyboardChangeRef.current?.(keyboardTop, rawOverlap);
    };

    const onHide = (event?: { duration?: number }) => {
      const durationMs = resolveKeyboardAnimationDuration(event?.duration, fallbackMs);
      animate(0, durationMs);
      const windowHeight = Dimensions.get("window").height;
      onKeyboardChangeRef.current?.(windowHeight, 0);
    };

    const showEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [bottomInset, enabled, gap, keyboardInset, tabBarHeight]);

  return keyboardInset;
}
