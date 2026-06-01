import { useCallback, useEffect, useRef } from "react";
import { Keyboard, Platform } from "react-native";
import { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { MESSAGE_THREAD_ANDROID_PAN_CLEARANCE_PX } from "@/shared/lib/messageThreadLayout";

/**
 * Message thread / Android only.
 *
 * What sets footer lift (translateY on `androidFooterDock`):
 * - `MESSAGE_THREAD_ANDROID_PAN_CLEARANCE_PX` in messageThreadLayout.ts — the only tuning knob.
 * - Applied on composer focus and again on `keyboardDidShow` (same value, no second animation).
 * - Reset only on `keyboardDidHide` (not on blur — blur can fire while the keyboard stays open).
 *
 * System `pan` moves the window; this hook adds a fixed extra lift for Gboard chrome / pan undershoot.
 */
export function useMessageThreadAndroidFooterLift(
  clearancePx = MESSAGE_THREAD_ANDROID_PAN_CLEARANCE_PX,
) {
  const footerLift = useSharedValue(0);
  const clearanceRef = useRef(clearancePx);
  clearanceRef.current = clearancePx;

  const applyClearance = useCallback(() => {
    if (Platform.OS !== "android") return;
    footerLift.value = clearanceRef.current;
  }, [footerLift]);

  const onComposerFocus = useCallback(() => {
    applyClearance();
  }, [applyClearance]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      applyClearance();
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      footerLift.value = 0;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [applyClearance, footerLift]);

  const footerDockStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: -footerLift.value }],
    }),
    [footerLift],
  );

  return { footerDockStyle, footerLift, onComposerFocus };
}
