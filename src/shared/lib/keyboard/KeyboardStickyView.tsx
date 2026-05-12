/**
 * KeyboardStickyView — враппер для sticky-footer элементов (composer, кнопки).
 *
 * Анимирует translateY вверх синхронно с появлением клавиатуры,
 * так что footer всегда остаётся прямо над клавиатурой.
 *
 * Использование:
 *   <KeyboardStickyView bottomInset={insets.bottom} tabBarHeight={tabBarHeight}>
 *     <CommentComposer ... />
 *   </KeyboardStickyView>
 */

import React from "react";
import { Animated, StyleSheet } from "react-native";
import { useKeyboardInset, type KeyboardInsetOptions } from "./useKeyboardInset";

interface KeyboardStickyViewProps extends KeyboardInsetOptions {
  children: React.ReactNode;
  style?: object;
}

export function KeyboardStickyView({
  children,
  style,
  ...insetOptions
}: KeyboardStickyViewProps) {
  const keyboardInset = useKeyboardInset(insetOptions);

  return (
    <Animated.View
      style={[styles.container, style, { paddingBottom: keyboardInset }]}
    >
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
  },
});
