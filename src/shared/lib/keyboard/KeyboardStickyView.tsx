/**
 * KeyboardStickyView — враппер для sticky-footer (composer, кнопки).
 * `paddingBottom` анимируется через Reanimated (`useKeyboardInset`).
 */

import React from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useKeyboardInset, type KeyboardInsetOptions } from "./useKeyboardInset";

interface KeyboardStickyViewProps extends KeyboardInsetOptions {
  children: React.ReactNode;
  style?: object;
  /** Subtract from computed inset (e.g. Android adjustResize trim). */
  insetTrim?: number;
}

export function KeyboardStickyView({
  children,
  style,
  insetTrim = 0,
  ...insetOptions
}: KeyboardStickyViewProps) {
  const keyboardInset = useKeyboardInset(insetOptions);

  const animatedStyle = useAnimatedStyle(
    () => ({
      paddingBottom: Math.max(0, keyboardInset.value - insetTrim),
    }),
    [insetTrim, keyboardInset],
  );

  return <Animated.View style={[styles.container, style, animatedStyle]}>{children}</Animated.View>;
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
