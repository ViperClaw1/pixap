import { memo, useMemo } from "react";
import { View, StyleSheet, Animated, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useShimmerProgress } from "./ShimmerProvider";
import { getSkeletonShimmerColors } from "./shimmerTheme";

type Props = {
  width: number;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  isDark: boolean;
};

/**
 * Clipped block with a left→right shimmer (native-driver friendly translateX on wrapper).
 */
function ShimmerSurfaceInner({ width, height, borderRadius = 0, style, isDark }: Props) {
  const progress = useShimmerProgress();
  const { base, peak } = getSkeletonShimmerColors(isDark);

  const translateX = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width],
      }),
    [progress, width],
  );

  const stripeWidth = Math.max(width * 2, 120);

  return (
    <View style={[{ width, height, borderRadius, backgroundColor: base, overflow: "hidden" }, style]}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: -width,
          width: stripeWidth,
          height,
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={["transparent", peak, "transparent"]}
          locations={[0.35, 0.5, 0.65]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export const ShimmerSurface = memo(ShimmerSurfaceInner);
