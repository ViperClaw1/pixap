import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { Dimensions, Keyboard, Platform, type View } from "react-native";
import { cancelAnimation, useAnimatedStyle, useSharedValue } from "react-native-reanimated";

const MAX_LIFT_PX = 40;

function resolveKeyboardTop(
  screenY: number | undefined,
  windowHeight: number,
  keyboardHeight: number,
): number {
  const fallbackTop = windowHeight - keyboardHeight;
  let keyboardTop = screenY ?? fallbackTop;

  if (keyboardTop < windowHeight * 0.35 || keyboardTop > windowHeight + 8) {
    keyboardTop = Dimensions.get("screen").height - keyboardHeight;
  }

  return keyboardTop;
}

/**
 * Message thread / Android only. System pan lifts the window; this adds a small translateY
 * on the footer dock ONLY when the footer still overlaps the keyboard after pan.
 *
 * No withTiming, no onFocus lift — avoids the second footer animation after pan.
 */
export function useMessageThreadAndroidFooterLift(footerRef: RefObject<View | null>) {
  const footerLift = useSharedValue(0);
  const keyboardOpenRef = useRef(false);
  const syncScheduledRef = useRef(false);
  const keyboardTopRef = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const applyLiftFromMeasure = () => {
      syncScheduledRef.current = false;
      if (!keyboardOpenRef.current) return;

      const keyboardTop = keyboardTopRef.current;
      if (keyboardTop == null) return;

      const footer = footerRef.current;
      if (!footer || typeof footer.measureInWindow !== "function") {
        cancelAnimation(footerLift);
        footerLift.value = 0;
        return;
      }

      footer.measureInWindow((_x, y, _w, h) => {
        const footerBottom = y + h;
        // Positive space = footer already above keyboard (pan succeeded) — never lift.
        const space = keyboardTop - footerBottom;
        const targetLift = space < -2 ? Math.min(MAX_LIFT_PX, -space + 2) : 0;

        cancelAnimation(footerLift);
        footerLift.value = targetLift;
      });
    };

    const scheduleMeasure = (keyboardTop: number) => {
      keyboardTopRef.current = keyboardTop;
      if (syncScheduledRef.current) return;
      syncScheduledRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(applyLiftFromMeasure);
      });
    };

    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      keyboardOpenRef.current = true;
      const windowHeight = Dimensions.get("window").height;
      scheduleMeasure(
        resolveKeyboardTop(
          event.endCoordinates.screenY,
          windowHeight,
          event.endCoordinates.height,
        ),
      );
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardOpenRef.current = false;
      syncScheduledRef.current = false;
      keyboardTopRef.current = null;
      cancelAnimation(footerLift);
      footerLift.value = 0;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [footerLift, footerRef]);

  const footerDockStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: -footerLift.value }],
    }),
    [footerLift],
  );

  return { footerDockStyle, footerLift };
}
