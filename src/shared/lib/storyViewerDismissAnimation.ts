import { runOnJS, withTiming, type SharedValue } from "react-native-reanimated";

/** Completes vertical dismiss on UI thread before navigation pop (avoids mid-flight freeze). */
export function animateStoryViewerDismissWorklet(
  dismissTranslateY: SharedValue<number>,
  dismissHeight: number,
  currentY: number,
  velocityY: number,
  onComplete: () => void,
) {
  "worklet";
  const remaining = Math.max(0, dismissHeight - currentY);
  const duration = Math.min(
    260,
    Math.max(120, (remaining / Math.max(Math.abs(velocityY), 520)) * 1000),
  );
  dismissTranslateY.value = withTiming(
    dismissHeight,
    { duration },
    (finished) => {
      if (finished) runOnJS(onComplete)();
    },
  );
}
