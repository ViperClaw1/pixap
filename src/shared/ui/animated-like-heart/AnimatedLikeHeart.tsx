import { useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

type Props = {
  liked: boolean;
  size: number;
  /** Outline heart color when not liked. */
  color: string;
  /** Filled heart color when liked. Defaults to accent red. */
  likedColor?: string;
};

const LIKE_SPRING_POP = { damping: 9, stiffness: 420, mass: 0.55 };
const LIKE_SPRING_SETTLE = { damping: 14, stiffness: 300, mass: 0.7 };

/** Heart icon with a short pop animation when transitioning to liked (not on unlike). */
export function AnimatedLikeHeart({ liked, size, color, likedColor = "#F4212E" }: Props) {
  const scale = useSharedValue(1);
  const prevLiked = useRef(liked);

  useEffect(() => {
    if (liked && !prevLiked.current) {
      scale.value = withSequence(
        withSpring(1.32, LIKE_SPRING_POP),
        withSpring(1, LIKE_SPRING_SETTLE),
      );
    }
    prevLiked.current = liked;
  }, [liked, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={liked ? "heart" : "heart-outline"} size={size} color={liked ? likedColor : color} />
    </Animated.View>
  );
}
