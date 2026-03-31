import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, Easing } from "react-native";

type Ctx = {
  /** 0 → 1 loop; child surfaces interpolate translateX */
  progress: Animated.Value;
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
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      progress.setValue(0);
    };
  }, [active, progress]);

  const value = useMemo(() => ({ progress }), [progress]);

  return <ShimmerContext.Provider value={value}>{children}</ShimmerContext.Provider>;
}
