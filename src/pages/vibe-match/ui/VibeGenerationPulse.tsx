import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const DOT_COUNT = 3;

type Props = {
  active: boolean;
};

function PulseDot({ index, active }: { index: number; active: boolean }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    if (!active) {
      cancelAnimation(opacity);
      opacity.value = 0.3;
      return;
    }
    opacity.value = withDelay(
      index * 300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
          withTiming(0.3, { duration: 500, easing: Easing.in(Easing.cubic) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [active, index, opacity]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: interpolate(opacity.value, [0.3, 1], [0.85, 1.2]) }],
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

export function VibeGenerationPulse({ active }: Props) {
  if (!active) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      {Array.from({ length: DOT_COUNT }, (_, index) => (
        <PulseDot key={`pulse-dot-${index}`} index={index} active={active} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.25)",
    zIndex: 5,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ffffff",
  },
});
