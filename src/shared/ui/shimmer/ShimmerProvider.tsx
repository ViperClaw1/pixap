import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

type Ctx = {
  /** 0 → 1 loop; child surfaces interpolate translateX */
  progress: SharedValue<number>;
};

const ShimmerContext = createContext<Ctx | null>(null);

export function useShimmerProgress() {
  const ctx = useContext(ShimmerContext);
  if (!ctx) {
    throw new Error("useShimmerProgress must be used within ShimmerProvider");
  }
  return ctx.progress;
}

type Props = {
  active: boolean;
  children: ReactNode;
};

/**
 * Single shared progress animation for all skeleton surfaces on screen (one loop, synced shimmer).
 */
export function ShimmerProvider({ active, children }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }

    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );

    return () => {
      cancelAnimation(progress);
      progress.value = 0;
    };
  }, [active, progress]);

  const value = useMemo(() => ({ progress }), [progress]);

  return <ShimmerContext.Provider value={value}>{children}</ShimmerContext.Provider>;
}
