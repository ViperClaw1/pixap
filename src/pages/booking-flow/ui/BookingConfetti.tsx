import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

const COLORS = ["#9333ea", "#db2777", "#f97316", "#22c55e"] as const;
const PARTICLE_COUNT = 12;

type Particle = {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  color: string;
};

type Props = {
  active: boolean;
};

export function BookingConfetti({ active }: Props) {
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        opacity: new Animated.Value(1),
        color: COLORS[index % COLORS.length],
      })),
    [],
  );
  const launchedRef = useRef(false);

  useEffect(() => {
    if (!active || launchedRef.current) return;
    launchedRef.current = true;
    particles.forEach((particle) => {
      const vx = (Math.random() - 0.5) * 400;
      const vy = -Math.random() * 300 - 100;
      particle.x.setValue(0);
      particle.y.setValue(0);
      particle.opacity.setValue(1);
      Animated.parallel([
        Animated.decay(particle.x, { velocity: vx, deceleration: 0.997, useNativeDriver: true }),
        Animated.decay(particle.y, { velocity: vy, deceleration: 0.997, useNativeDriver: true }),
        Animated.timing(particle.opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]).start();
    });
  }, [active, particles]);

  useEffect(() => {
    if (!active) launchedRef.current = false;
  }, [active]);

  if (!active) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      {particles.map((particle, index) => (
        <Animated.View
          key={`confetti-${index}`}
          style={[
            styles.dot,
            {
              backgroundColor: particle.color,
              opacity: particle.opacity,
              transform: [{ translateX: particle.x }, { translateY: particle.y }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
