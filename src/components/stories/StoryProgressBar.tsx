import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

interface StoryProgressBarProps {
  count: number;
  currentIndex: number;
  progress: SharedValue<number>;
}

function ProgressSegment({
  index,
  currentIndex,
  progress,
}: {
  index: number;
  currentIndex: number;
  progress: SharedValue<number>;
}) {
  const fillStyle = useAnimatedStyle(() => {
    let width = "0%";
    if (index < currentIndex) width = "100%";
    else if (index === currentIndex) width = `${Math.min(100, Math.max(0, progress.value * 100))}%`;
    return { width };
  }, [currentIndex, index, progress]);

  return (
    <View key={`story-progress-${index}`} style={styles.track}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

function StoryProgressBarComponent({ count, currentIndex, progress }: StoryProgressBarProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, idx) => {
        return <ProgressSegment key={`story-progress-${idx}`} index={idx} currentIndex={currentIndex} progress={progress} />;
      })}
    </View>
  );
}

export const StoryProgressBar = memo(StoryProgressBarComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 4,
    width: "100%",
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#fff",
  },
});
