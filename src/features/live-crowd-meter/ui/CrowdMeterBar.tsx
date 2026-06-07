import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import type { CrowdLevel } from "@/entities/venue-crowd";

const SEGMENT_COUNT = 5;

const FILLED_SEGMENTS: Record<CrowdLevel, number> = {
  empty: 0,
  low: 1,
  medium: 3,
  busy: 4,
  packed: 5,
};

const SEGMENT_COLORS = ["#2dd4bf", "#2dd4bf", "#fbbf24", "#f97316", "#ef4444"] as const;

type Props = {
  crowdLevel: CrowdLevel;
  trackColor: string;
};

export function CrowdMeterBar({ crowdLevel, trackColor }: Props) {
  const filledCount = FILLED_SEGMENTS[crowdLevel];
  const anims = useRef(Array.from({ length: SEGMENT_COUNT }, () => new Animated.Value(0))).current;

  useEffect(() => {
    anims.forEach((anim, index) => {
      anim.setValue(0);
      if (index < filledCount) {
        Animated.timing(anim, {
          toValue: 1,
          duration: 320,
          delay: index * 80,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });
  }, [anims, crowdLevel, filledCount]);

  return (
    <View style={styles.row} accessibilityRole="progressbar">
      {anims.map((anim, index) => (
        <View key={`crowd-seg-${index}`} style={[styles.segmentTrack, { backgroundColor: trackColor }]}>
          <Animated.View
            style={[
              styles.segmentFill,
              {
                backgroundColor: SEGMENT_COLORS[index],
                opacity: anim,
                transform: [
                  {
                    scaleX: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 5,
    marginTop: 10,
  },
  segmentTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  segmentFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
    transformOrigin: "left",
  },
});
