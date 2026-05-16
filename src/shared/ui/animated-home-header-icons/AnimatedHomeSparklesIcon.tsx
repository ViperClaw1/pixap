import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

type Props = {
  size: number;
  color: string;
};

/** Subtle looping “AI sparkle” pulse for the Pix AI booking chip (React Native–friendly; no lucide-web). */
export function AnimatedHomeSparklesIcon({ size, color }: Props) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(0.88, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(glow);
    };
  }, [scale, glow]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.78 + 0.22 * glow.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name="sparkles" size={size} color={color} />
    </Animated.View>
  );
}
