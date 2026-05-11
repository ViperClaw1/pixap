import { useEffect } from "react";
import { Animated, Dimensions, Keyboard, Platform } from "react-native";
import { KEYBOARD_GAP } from "./constants";

export function useThreadKeyboardInset(
  keyboardInsetAnim: Animated.Value,
  tabBarHeight: number,
  _stableBottomInset: number,
) {
  useEffect(() => {
    const animateKeyboardInset = (toValue: number, duration?: number) => {
      Animated.timing(keyboardInsetAnim, {
        toValue,
        duration: duration ?? 250,
        useNativeDriver: false,
      }).start();
    };
    const onKeyboardFrameChange = (event: { endCoordinates: { height: number; screenY?: number }; duration?: number }) => {
      const windowHeight = Dimensions.get("window").height;
      const keyboardTop = event.endCoordinates.screenY ?? windowHeight - event.endCoordinates.height;
      const overlap = Math.max(0, windowHeight - keyboardTop);
      const nextInset = Math.max(0, overlap - tabBarHeight + KEYBOARD_GAP);
      animateKeyboardInset(nextInset, event.duration);
    };
    const onKeyboardHide = (event?: { duration?: number }) => {
      animateKeyboardInset(0, event?.duration);
    };
    const showEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, onKeyboardFrameChange);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardInsetAnim, tabBarHeight]);
}
