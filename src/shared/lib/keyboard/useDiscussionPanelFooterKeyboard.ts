import type { ElementRef } from "react";
import { Platform, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import {
  useAndroidPanKeyboardClearance,
} from "./useAndroidPanKeyboardClearance";

export { ANDROID_PAN_KEYBOARD_CLEARANCE } from "./useAndroidPanKeyboardClearance";

export const DISCUSSION_ANDROID_FOOTER_PADDING = 8;

/**
 * Android: animated clearance lift in sync with system pan (see useAndroidPanKeyboardClearance).
 * iOS: KeyboardAvoidingView in DiscussionGlassSheet handles the sheet.
 */
export function useDiscussionPanelFooterKeyboard(
  _getFocusedInput?: () => ElementRef<typeof TextInput> | null,
  isActive = true,
) {
  const useAndroidLift = Platform.OS === "android";
  const { androidLiftStyle, onComposerFocus, onComposerBlur } = useAndroidPanKeyboardClearance(isActive);

  return {
    RootOuter: useAndroidLift ? Animated.View : View,
    androidRootLiftStyle: useAndroidLift ? androidLiftStyle : undefined,
    onComposerFocus,
    onComposerBlur,
  };
}
