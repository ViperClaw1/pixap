import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import { Dimensions, Keyboard, Platform, type View } from "react-native";
import { cancelAnimation, useAnimatedStyle, useSharedValue } from "react-native-reanimated";

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
 * Message thread / Android only. `softwareKeyboardLayoutMode: pan` may not align an
 * absolute footer with the keyboard; measure footer vs keyboard top and apply translateY.
 */
export function useMessageThreadAndroidFooterSync(footerRef: RefObject<View | null>) {
  const footerOffset = useSharedValue(0);
  const keyboardOpenRef = useRef(false);
  const keyboardTopRef = useRef<number | null>(null);
  const syncTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const applySyncRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const clearSyncTimeouts = () => {
      for (const id of syncTimeoutsRef.current) {
        clearTimeout(id);
      }
      syncTimeoutsRef.current = [];
    };

    const applySyncFromMeasure = () => {
      if (!keyboardOpenRef.current) return;

      const keyboardTop = keyboardTopRef.current;
      if (keyboardTop == null) return;

      const footer = footerRef.current;
      if (!footer || typeof footer.measureInWindow !== "function") {
        cancelAnimation(footerOffset);
        footerOffset.value = 0;
        return;
      }

      footer.measureInWindow((_x, y, _w, h) => {
        const footerBottom = y + h;
        cancelAnimation(footerOffset);
        footerOffset.value = keyboardTop - footerBottom;
      });
    };

    applySyncRef.current = applySyncFromMeasure;

    const scheduleSync = (keyboardTop: number) => {
      keyboardTopRef.current = keyboardTop;
      applySyncFromMeasure();
      requestAnimationFrame(() => {
        requestAnimationFrame(applySyncFromMeasure);
      });
      clearSyncTimeouts();
      for (const delayMs of [50, 150, 280]) {
        syncTimeoutsRef.current.push(setTimeout(applySyncFromMeasure, delayMs));
      }
    };

    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      keyboardOpenRef.current = true;
      const windowHeight = Dimensions.get("window").height;
      scheduleSync(
        resolveKeyboardTop(
          event.endCoordinates.screenY,
          windowHeight,
          event.endCoordinates.height,
        ),
      );
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardOpenRef.current = false;
      keyboardTopRef.current = null;
      clearSyncTimeouts();
      cancelAnimation(footerOffset);
      footerOffset.value = 0;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      clearSyncTimeouts();
      applySyncRef.current = () => {};
    };
  }, [footerOffset, footerRef]);

  const requestFooterSync = useCallback(() => {
    applySyncRef.current();
  }, []);

  const footerDockStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: footerOffset.value }],
    }),
    [footerOffset],
  );

  return { footerDockStyle, footerOffset, requestFooterSync };
}
