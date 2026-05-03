import { useEffect } from "react";
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

interface Params {
  durationMs: number;
  paused: boolean;
  itemKey: string;
  onComplete: () => void;
}

interface StoryProgressResult {
  progress: SharedValue<number>;
  reset: () => void;
}

export const useStoryProgress = ({
  durationMs,
  paused,
  itemKey,
  onComplete,
}: Params): StoryProgressResult => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    if (paused) {
      cancelAnimation(progress);
      return;
    }

    progress.value = withTiming(
      1,
      { duration: durationMs, easing: Easing.linear },
      (finished) => {
        if (finished) {
          runOnJS(onComplete)();
        }
      },
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [durationMs, itemKey, onComplete, paused, progress]);

  useEffect(() => {
    if (paused) {
      cancelAnimation(progress);
      return;
    }
    if (progress.value >= 1) return;

    const remaining = Math.max(0, Math.round((1 - progress.value) * durationMs));
    progress.value = withTiming(
      1,
      { duration: remaining, easing: Easing.linear },
      (finished) => {
        if (finished) {
          runOnJS(onComplete)();
        }
      },
    );
  }, [durationMs, onComplete, paused, progress]);

  return {
    progress,
    reset: () => {
      cancelAnimation(progress);
      progress.value = 0;
    },
  };
};
