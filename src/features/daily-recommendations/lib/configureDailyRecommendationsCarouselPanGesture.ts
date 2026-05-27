import type { PanGesture } from "react-native-gesture-handler";

/** Lets parent Android back-swipe win on the dedicated left edge overlay. */
export function configureDailyRecommendationsCarouselPanGesture(panGesture: PanGesture) {
  "worklet";
  panGesture.activeOffsetX([-14, 14]);
  panGesture.failOffsetY([-12, 12]);
}
