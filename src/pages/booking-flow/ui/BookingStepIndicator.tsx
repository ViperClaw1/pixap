import { useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutChangeEvent, StyleSheet, View } from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";

type Props = {
  step: number;
  totalSteps: number;
};

export function BookingStepIndicator({ step, totalSteps }: Props) {
  const { colors } = useAppTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (!trackWidth) return;
    const target = ((step + 1) / totalSteps) * trackWidth;
    Animated.timing(progress, {
      toValue: target,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, step, totalSteps, trackWidth]);

  return (
    <View
      style={styles.wrap}
      onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      <View style={[styles.track, { backgroundColor: colors.border }]} />
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: colors.primary,
            width: progress,
          },
        ]}
      />
      <View style={styles.dots}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <View
            key={`booking-step-dot-${index}`}
            style={[
              styles.dot,
              {
                backgroundColor: index <= step ? colors.primary : colors.border,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    justifyContent: "center",
  },
  track: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
    height: 4,
    top: 2,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 2,
    height: 4,
    borderRadius: 4,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
