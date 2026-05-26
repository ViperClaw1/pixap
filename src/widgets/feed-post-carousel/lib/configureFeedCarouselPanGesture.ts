import type { PanGesture } from "react-native-gesture-handler";

/** Lets parent FlashList/ScrollView scroll vertically while keeping horizontal carousel swipes. */
export function configureFeedCarouselPanGesture(panGesture: PanGesture) {
  "worklet";
  panGesture.activeOffsetX([-14, 14]);
  panGesture.failOffsetY([-12, 12]);
}
