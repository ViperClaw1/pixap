import { Platform, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useKeyboardInset } from "./useKeyboardInset";

export const DISCUSSION_ANDROID_FOOTER_PADDING = 8;
const ANDROID_KEYBOARD_GAP = 8;

/** Android: lift list + footer above keyboard (navigation modal + RN Modal). iOS: no-op. */
export function useDiscussionPanelFooterKeyboard(isActive = true) {
  const useAndroidLift = Platform.OS === "android";

  const keyboardInset = useKeyboardInset({
    enabled: useAndroidLift && isActive,
    gap: ANDROID_KEYBOARD_GAP,
    ignoreWindowResize: true,
  });

  const androidRootLiftStyle = useAnimatedStyle(
    () => ({
      paddingBottom: keyboardInset.value,
    }),
    [keyboardInset],
  );

  return {
    RootOuter: useAndroidLift ? Animated.View : View,
    androidRootLiftStyle: useAndroidLift ? androidRootLiftStyle : undefined,
  };
}
