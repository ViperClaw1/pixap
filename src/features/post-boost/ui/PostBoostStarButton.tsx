import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

const BOOST_STAR_COLOR = "#F5B301";

type Props = {
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function PostBoostStarButton({ active, disabled, onPress }: Props) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (active || disabled) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(withTiming(1.14, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      false,
    );
  }, [active, disabled, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? "Post boosted in feed" : "Boost post in feed"}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.hit, pressed && !disabled ? styles.pressed : null]}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons name={active ? "star" : "star-outline"} size={23} color={BOOST_STAR_COLOR} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  pressed: { opacity: 0.85 },
});
