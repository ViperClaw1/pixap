/**
 * KeyboardStickyView — sticky-footer (composer, кнопки).
 * Поднимает футер через `translateY` (без relayout на каждом кадре).
 */

import React from "react";
import { StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useKeyboardInset, type KeyboardInsetOptions } from "./useKeyboardInset";

interface KeyboardStickyViewProps extends KeyboardInsetOptions {
  children: React.ReactNode;
  style?: object;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Subtract from computed inset (e.g. Android adjustResize trim). */
  insetTrim?: number;
  /** Reuse inset from parent — avoids duplicate `useAnimatedKeyboard` subscriptions. */
  inset?: SharedValue<number>;
}

export function KeyboardStickyView({
  children,
  style,
  onLayout,
  insetTrim = 0,
  inset: insetProp,
  ...insetOptions
}: KeyboardStickyViewProps) {
  const ownedInset = useKeyboardInset(insetProp ? { enabled: false } : insetOptions);
  const keyboardInset = insetProp ?? ownedInset;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(0, keyboardInset.value - insetTrim) }],
  }));

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
