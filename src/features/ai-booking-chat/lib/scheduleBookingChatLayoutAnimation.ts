import { LayoutAnimation, Platform, UIManager } from "react-native";

let layoutAnimOnAndroid = false;

function tryEnableLayoutAnimationOnAndroid() {
  if (layoutAnimOnAndroid || Platform.OS !== "android") return;
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
  layoutAnimOnAndroid = true;
}

/** Smooth layout transitions when chat bubbles change height (typing / streaming). */
export function scheduleBookingChatLayoutAnimation() {
  tryEnableLayoutAnimationOnAndroid();
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}
