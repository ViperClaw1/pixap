/**
 * useKeyboardInset — универсальный хук для управления клавиатурой.
 *
 * Возвращает Animated.Value, которое анимируется от 0 до высоты overlap
 * клавиатуры с контентом. Используйте его как paddingBottom на ScrollView
 * или контейнере с инпутами.
 *
 * Особенности:
 * - iOS: keyboardWillChangeFrame (синхронно с анимацией системы)
 * - Android: keyboardDidShow/Hide (единственные надёжные события)
 * - Корректно вычитает tabBarHeight и safeArea bottomInset
 * - Не двигает контент если overlap === 0
 * - onKeyboardChange колбэк для дополнительной логики (скролл к инпуту)
 */

import { useEffect, useRef } from "react";
import { Animated, Dimensions, Keyboard, Platform } from "react-native";

export interface KeyboardInsetOptions {
  /** Высота таб-бара (если экран содержит таб-бар снизу). По умолчанию 0. */
  tabBarHeight?: number;
  /**
   * Дополнительный отступ между клавиатурой и активным инпутом.
   * По умолчанию: 16px (iOS) / 24px (Android).
   */
  gap?: number;
  /**
   * Дополнительный offset, уже занятый снизу (например safe area bottom).
   * Вычитается из overlap чтобы не создавать двойной отступ.
   * По умолчанию 0.
   */
  bottomInset?: number;
  /**
   * Использовать нативный драйвер для анимации (только для transform/opacity).
   * Используйте true если применяете значение как translateY.
   * По умолчанию false (для paddingBottom/margin).
   */
  useNativeDriver?: boolean;
  /**
   * Отключить обработку клавиатуры (хук подпишется, но не будет анимировать).
   * Используйте для компонентов где на определённой платформе поведение не нужно.
   * По умолчанию true.
   */
  enabled?: boolean;
  /**
   * Колбэк, вызываемый при каждом изменении клавиатуры.
   * keyboardTop — Y-координата верхней границы клавиатуры (0 = скрыта).
   */
  onKeyboardChange?: (keyboardTop: number, keyboardHeight: number) => void;
}

export function useKeyboardInset(options: KeyboardInsetOptions = {}) {
  const {
    tabBarHeight = 0,
    gap = Platform.OS === "android" ? 24 : 16,
    bottomInset = 0,
    useNativeDriver = false,
    enabled = true,
    onKeyboardChange,
  } = options;

  const keyboardInsetAnim = useRef(new Animated.Value(0)).current;
  const onKeyboardChangeRef = useRef(onKeyboardChange);
  onKeyboardChangeRef.current = onKeyboardChange;

  useEffect(() => {
    const animate = (toValue: number, duration = 250) => {
      if (!enabled) return;
      Animated.timing(keyboardInsetAnim, {
        toValue,
        duration,
        useNativeDriver,
      }).start();
    };

    const onShow = (event: {
      endCoordinates: { height: number; screenY?: number };
      duration?: number;
    }) => {
      const windowHeight = Dimensions.get("window").height;
      const keyboardTop =
        event.endCoordinates.screenY ??
        windowHeight - event.endCoordinates.height;
      const rawOverlap = Math.max(0, windowHeight - keyboardTop);
      const inset = Math.max(0, rawOverlap - tabBarHeight - bottomInset + gap);
      animate(inset, event.duration);
      onKeyboardChangeRef.current?.(keyboardTop, rawOverlap);
    };

    const onHide = (event?: { duration?: number }) => {
      animate(0, event?.duration);
      const windowHeight = Dimensions.get("window").height;
      onKeyboardChangeRef.current?.(windowHeight, 0);
    };

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardInsetAnim, tabBarHeight, gap, bottomInset]);

  return keyboardInsetAnim;
}
