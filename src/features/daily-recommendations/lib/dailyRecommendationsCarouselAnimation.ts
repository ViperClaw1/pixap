import { Easing } from "react-native-reanimated";

export const DAILY_RECOMMENDATIONS_CAROUSEL_DURATION_MS = 420;

/** Cubic ease-out for snap transitions between recommendation slides. */
export const dailyRecommendationsCarouselAnimation = {
  type: "timing" as const,
  config: {
    duration: DAILY_RECOMMENDATIONS_CAROUSEL_DURATION_MS,
    easing: Easing.out(Easing.cubic),
  },
};
