import { useCallback, useEffect, useRef } from "react";
import { Keyboard, Platform } from "react-native";
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { FOOTER_VERTICAL_PADDING } from "@/shared/lib/messageThreadLayout";

const ANDROID_KEYBOARD_ANIM_MS = 280;
const FOOTER_PADDING_CLOSED = FOOTER_VERTICAL_PADDING;
const FOOTER_PADDING_OPEN = FOOTER_VERTICAL_PADDING * 2;

function resolveKeyboardDuration(eventDuration: number | undefined): number {
  if (eventDuration != null && eventDuration > 80) {
    return eventDuration;
  }
  return ANDROID_KEYBOARD_ANIM_MS;
}

/**
 * Android + pan: bottom footer padding is overlapped by the keyboard — animate extra
 * paddingBottom in sync with the native keyboard transition (on focus / hide).
 */
export function useMessageThreadAndroidFooterPadding() {
  const paddingBottom = useSharedValue(FOOTER_PADDING_CLOSED);
  const keyboardOpenRef = useRef(false);

  const animatePadding = useCallback(
    (open: boolean, duration = ANDROID_KEYBOARD_ANIM_MS) => {
      keyboardOpenRef.current = open;
      paddingBottom.value = withTiming(open ? FOOTER_PADDING_OPEN : FOOTER_PADDING_CLOSED, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    },
    [paddingBottom],
  );

  const onComposerFocus = useCallback(() => {
    if (Platform.OS !== "android") return;
    animatePadding(true);
  }, [animatePadding]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const hideSub = Keyboard.addListener("keyboardDidHide", (event) => {
      animatePadding(false, resolveKeyboardDuration(event.duration));
    });
    return () => hideSub.remove();
  }, [animatePadding]);

  const footerAnimatedStyle = useAnimatedStyle(
    () => ({
      paddingBottom: paddingBottom.value,
    }),
    [paddingBottom],
  );

  return {
    footerAnimatedStyle,
    paddingBottom,
    keyboardOpenRef,
    onComposerFocus,
  };
}
