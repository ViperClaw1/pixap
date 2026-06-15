import { useEffect, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { AppPressable } from "@/shared/ui/app-pressable";
import type { PixAIVibeTimeline } from "@/entities/pixai";
import { TIMELINE_GRADIENT } from "@/shared/theme/gradients";

const OPTIONS: PixAIVibeTimeline[] = ["day", "evening", "night"];
const THUMB_INSET = 3;

type Props = {
  value: PixAIVibeTimeline;
  onChange: (value: PixAIVibeTimeline) => void;
  disabled?: boolean;
};

export function VibeTimelineSelector({ value, onChange, disabled = false }: Props) {
  const { t } = useTranslation();
  const thumbX = useSharedValue(0);
  const [barWidth, setBarWidth] = useState(0);
  const activeIndex = Math.max(0, OPTIONS.indexOf(value));
  const slotWidth = barWidth > 0 ? barWidth / OPTIONS.length : 0;

  useEffect(() => {
    if (!barWidth) return;
    const nextSlotWidth = barWidth / OPTIONS.length;
    cancelAnimation(thumbX);
    thumbX.value = withTiming(activeIndex * nextSlotWidth, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeIndex, barWidth, thumbX]);

  const thumbStyle = useAnimatedStyle(
    () => ({
      width: slotWidth > 0 ? slotWidth - 6 : 0,
      transform: [{ translateX: thumbX.value + THUMB_INSET }],
    }),
    [slotWidth],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={[styles.wrap, disabled && styles.disabled]} onLayout={onLayout}>
      <LinearGradient colors={[...TIMELINE_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bar}>
        {slotWidth > 0 ? <Animated.View style={[styles.thumb, thumbStyle]} /> : null}
        {OPTIONS.map((timelineKey) => (
          <AppPressable
            key={timelineKey}
            style={styles.slot}
            onPress={() => onChange(timelineKey)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === timelineKey }}
          >
            <Text style={[styles.slotText, value === timelineKey && styles.slotTextActive]}>
              {t(`vibeMatch.timeline.${timelineKey}`)}
            </Text>
          </AppPressable>
        ))}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  disabled: { opacity: 0.45 },
  bar: {
    minHeight: 44,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  thumb: {
    position: "absolute",
    top: 3,
    bottom: 3,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  slot: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    zIndex: 2,
  },
  slotText: {
    width: "100%",
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
  },
  slotTextActive: {
    color: "#1a1a1a",
    fontWeight: "800",
  },
});
