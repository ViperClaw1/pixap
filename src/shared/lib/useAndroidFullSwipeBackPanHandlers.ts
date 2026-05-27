import { useMemo, useRef } from "react";
import { PanResponder, Platform } from "react-native";

/**
 * На Android у Native Stack (`react-native-screens`) жест «назад» из настроек
 * `gestureEnabled` / `fullScreenGestureEnabled` из `@react-navigation/native-stack`
 * по сути не даёт полноэкранного swipe-back: в типах эти опции помечены как iOS-only.
 *
 * Поэтому на Android добавляем явный жест: горизонтальный свайп вправо с любой точки
 * экрана через React Native `PanResponder` → `navigation.goBack()`.
 *
 * Библиотеки: только встроенный `react-native` (`PanResponder`, `Platform`).
 */
type NavBack = { goBack: () => void; canGoBack: () => boolean };

export function useAndroidFullSwipeBackPanHandlers(
  navigation: NavBack,
  options?: { swipeBackFallback?: () => void },
) {
  const navRef = useRef(navigation);
  navRef.current = navigation;
  const fallbackRef = useRef(options?.swipeBackFallback);
  fallbackRef.current = options?.swipeBackFallback;

  return useMemo(() => {
    if (Platform.OS !== "android") {
      return {};
    }

    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        g.dx > 5 && Math.abs(g.dx) > Math.abs(g.dy) * 1.1,
      onPanResponderRelease: (_e, g) => {
        const swipeRight = g.dx > 36 && Math.abs(g.dx) > Math.abs(g.dy) * 1.05;
        if (!swipeRight) return;
        const nav = navRef.current;
        if (nav.canGoBack()) {
          nav.goBack();
          return;
        }
        fallbackRef.current?.();
      },
    });

    return panResponder.panHandlers;
  }, []);
}
