import { memo } from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useShimmerProgress } from "./ShimmerProvider";
import { getSkeletonShimmerColors } from "./shimmerTheme";

type Props = {
  width: number;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Clipped block with a left→right shimmer (Reanimated translateX on wrapper).
 */
function ShimmerSurfaceInner({ width, height, borderRadius = 0, style }: Props) {
  const { isDark } = useAppTheme();
  const progress = useShimmerProgress();
  const { base, peak } = getSkeletonShimmerColors(isDark);
  const layoutWidth = typeof width === "number" && Number.isFinite(width) ? width : 0;
  const layoutHeight = typeof height === "number" && Number.isFinite(height) ? height : 0;
  const stripeWidth = Math.max(layoutWidth * 2, 120);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -layoutWidth + progress.value * layoutWidth * 2 }],
  }));

  return (
    <View
      style={[{ width: layoutWidth, height: layoutHeight, borderRadius, backgroundColor: base, overflow: "hidden" }, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: 0,
            left: -layoutWidth,
            width: stripeWidth,
            height: layoutHeight,
          },
          animatedStyle,
        ]}
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
