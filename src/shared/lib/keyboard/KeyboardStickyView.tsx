/**
 * KeyboardStickyView — sticky-footer (composer, кнопки).
 * Поднимает футер через `translateY` + `bottom` (без relayout детей на каждом кадре).
 */

import React from "react";
import { StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useKeyboardInset, type KeyboardInsetOptions } from "./useKeyboardInset";

/** Fade out safe-area offset once keyboard lift exceeds this (px). */
export const IOS_STICKY_SAFE_AREA_FADE_LIFT_PX = 56;

interface KeyboardStickyViewProps extends KeyboardInsetOptions {
  children: React.ReactNode;
  style?: object;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Subtract from computed inset (e.g. Android adjustResize trim). */
  insetTrim?: number;
  /** Reuse inset from parent — avoids duplicate `useAnimatedKeyboard` subscriptions. */
  inset?: SharedValue<number>;
  /** Home-indicator inset when keyboard is closed (iOS). */
  safeAreaBottom?: number;
}

export function KeyboardStickyView({
  children,
  style,
  onLayout,
  insetTrim = 0,
  inset: insetProp,
  safeAreaBottom = 0,
  ...insetOptions
}: KeyboardStickyViewProps) {
  const ownedInset = useKeyboardInset(insetProp ? { enabled: false } : { gap: 0, ...insetOptions });
  const keyboardInset = insetProp ?? ownedInset;

  const animatedStyle = useAnimatedStyle(() => {
    const lift = Math.max(0, keyboardInset.value - insetTrim);
    const fade = Math.min(1, lift / IOS_STICKY_SAFE_AREA_FADE_LIFT_PX);
    return {
      transform: [{ translateY: -lift }],
      bottom: safeAreaBottom * (1 - fade),
    };
  });

  return (
    <Animated.View style={[styles.container, style, animatedStyle]} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9,
  },
});
