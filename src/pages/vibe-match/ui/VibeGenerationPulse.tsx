import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

const DOT_COUNT = 3;

type Props = {
  active: boolean;
};

export function VibeGenerationPulse({ active }: Props) {
  const anims = useRef(Array.from({ length: DOT_COUNT }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    if (!active) {
      anims.forEach((anim) => anim.setValue(0.3));
      return;
    }
    const loops = anims.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 300),
          Animated.timing(anim, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 500,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [active, anims]);

  if (!active) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      {anims.map((anim, index) => (
        <Animated.View
          key={`pulse-dot-${index}`}
          style={[
            styles.dot,
            {
              opacity: anim,
              transform: [
                {
                  scale: anim.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [0.85, 1.2],
                  }),
                },
              ],
            },
          ]}
        />
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
