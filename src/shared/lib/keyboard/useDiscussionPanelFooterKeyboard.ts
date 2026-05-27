import { Platform, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useKeyboardInset } from "./useKeyboardInset";

export const DISCUSSION_ANDROID_FOOTER_PADDING = 8;

/**
 * @deprecated Prefer `KeyboardStickyView` on the discussion footer.
 * Kept for callers that still lift the whole panel root on Android.
 */
export function useDiscussionPanelFooterKeyboard(isActive = true) {
  const useAndroidLift = Platform.OS === "android";

  const keyboardInset = useKeyboardInset({
    enabled: useAndroidLift && isActive,
    gap: 0,
    ignoreWindowResize: true,
  });

  const androidRootLiftStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardInset.value,
  }));

  return {
    RootOuter: useAndroidLift ? Animated.View : View,
    androidRootLiftStyle: useAndroidLift ? androidRootLiftStyle : undefined,
  };
}
