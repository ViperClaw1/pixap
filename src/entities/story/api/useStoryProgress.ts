import { useEffect, useRef } from "react";
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
  const prevItemKeyRef = useRef<string | null>(null);
  const prevDurationRef = useRef(durationMs);

  useEffect(() => {
    const isFirstMount = prevItemKeyRef.current === null;
    const itemKeyChanged = !isFirstMount && prevItemKeyRef.current !== itemKey;
    const durationChanged = !isFirstMount && prevDurationRef.current !== durationMs;

    const shouldHardReset = isFirstMount || itemKeyChanged || durationChanged;

    if (shouldHardReset) {
      cancelAnimation(progress);
      progress.value = 0;
    }

    if (paused) {
      cancelAnimation(progress);
      prevItemKeyRef.current = itemKey;
      prevDurationRef.current = durationMs;
      return;
    }

    const startFrom = Math.min(1, Math.max(0, progress.value));

    if (!shouldHardReset && startFrom >= 1) {
      prevItemKeyRef.current = itemKey;
      prevDurationRef.current = durationMs;
      return;
    }

    const remainingMs = shouldHardReset
      ? durationMs
      : Math.max(1, Math.round((1 - startFrom) * durationMs));

    progress.value = withTiming(
      1,
      { duration: remainingMs, easing: Easing.linear },
      (finished) => {
        if (finished) {
          runOnJS(onComplete)();
        }
      },
    );

    prevItemKeyRef.current = itemKey;
    prevDurationRef.current = durationMs;

    return () => {
      cancelAnimation(progress);
    };
  }, [durationMs, itemKey, onComplete, paused, progress]);

  return {
    progress,
    reset: () => {
      cancelAnimation(progress);
      progress.value = 0;
    },
  };
};
