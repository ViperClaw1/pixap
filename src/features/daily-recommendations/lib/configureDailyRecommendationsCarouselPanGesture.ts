import type { PanGesture } from "react-native-gesture-handler";

/** Horizontal paging only; left-edge back swipe stays on the screen overlay / iOS edge gesture. */
export function configureDailyRecommendationsCarouselPanGesture(panGesture: PanGesture) {
  "worklet";
  panGesture.activeOffsetX([-22, 22]);
  panGesture.failOffsetY([-14, 14]);
}
