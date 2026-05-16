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

/** Energetic pulse + slight tilt for the Vibe Matching chip icon. */
export function AnimatedHomeVibeIcon({ size, color }: Props) {
  const pulse = useSharedValue(1);
  const tilt = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 550, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 550, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    tilt.value = withRepeat(
      withSequence(
        withTiming(6, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(-6, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(tilt);
    };
  }, [pulse, tilt]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt.value}deg` }, { scale: pulse.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name="color-filter" size={size} color={color} />
    </Animated.View>
  );
}
