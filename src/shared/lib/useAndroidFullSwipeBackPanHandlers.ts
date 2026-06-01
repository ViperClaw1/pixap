import { useMemo, useRef, useEffect, type MutableRefObject } from "react";
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

export type AndroidSwipeBackSensitivity = "default" | "high";

type SwipeBackPreset = {
  captureDistancePx: number;
  releaseDistancePx: number;
  captureHorizontalBias: number;
  releaseHorizontalBias: number;
  /** Fast flick: min horizontal drag when velocity threshold is met. */
  minVelocityDistancePx: number;
  releaseVelocityX: number;
};

const SWIPE_BACK_PRESETS: Record<AndroidSwipeBackSensitivity, SwipeBackPreset> = {
  default: {
    captureDistancePx: 5,
    releaseDistancePx: 36,
    captureHorizontalBias: 1.1,
    releaseHorizontalBias: 1.05,
    minVelocityDistancePx: 0,
    releaseVelocityX: 0,
  },
  high: {
    captureDistancePx: 3,
    releaseDistancePx: 20,
    captureHorizontalBias: 1.0,
    releaseHorizontalBias: 1.0,
    minVelocityDistancePx: 12,
    releaseVelocityX: 0.2,
  },
};

export function useAndroidFullSwipeBackPanHandlers(
  navigation: NavBack,
  options?: {
    /** When returns true, default stack pop is skipped (e.g. inner wizard step). */
    onSwipeBack?: () => boolean;
    swipeBackFallback?: () => void;
    sensitivity?: AndroidSwipeBackSensitivity;
    /** When false, pan capture is disabled (e.g. inner step handles its own swipe). */
    enabledRef?: MutableRefObject<boolean>;
  },
) {
  const navRef = useRef(navigation);
  const interceptRef = useRef(options?.onSwipeBack);
  const fallbackRef = useRef<(() => void) | null>(null);
  const enabledRef = options?.enabledRef;
  const sensitivity = options?.sensitivity ?? "default";

  useEffect(() => {
    navRef.current = navigation;
    interceptRef.current = options?.onSwipeBack;
    fallbackRef.current = options?.swipeBackFallback ?? null;
  }, [navigation, options?.onSwipeBack, options?.swipeBackFallback]);

  return useMemo(() => {
    if (Platform.OS !== "android") {
      return {};
    }

    const preset = SWIPE_BACK_PRESETS[sensitivity];

    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) => {
        if (enabledRef?.current === false) return false;
        return (
          g.dx > preset.captureDistancePx &&
          Math.abs(g.dx) > Math.abs(g.dy) * preset.captureHorizontalBias
        );
      },
      onPanResponderRelease: (_e, g) => {
        const horizontalEnough =
          Math.abs(g.dx) > Math.abs(g.dy) * preset.releaseHorizontalBias;
        const distanceSwipe = g.dx > preset.releaseDistancePx && horizontalEnough;
        const velocitySwipe =
          preset.releaseVelocityX > 0 &&
          g.vx > preset.releaseVelocityX &&
          g.dx > preset.minVelocityDistancePx &&
          horizontalEnough;
        if (!distanceSwipe && !velocitySwipe) return;

        if (interceptRef.current?.()) return;

        const nav = navRef.current;
        if (nav.canGoBack()) {
          nav.goBack();
          return;
        }
        fallbackRef.current?.();
      },
    });

    return panResponder.panHandlers;
  }, [sensitivity]);
}
