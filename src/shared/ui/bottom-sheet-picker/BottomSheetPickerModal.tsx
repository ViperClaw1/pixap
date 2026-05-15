import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Modal, Platform, Pressable, ScrollView, type StyleProp, StyleSheet, Text, type ViewStyle, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useKeyboardInset } from "@/shared/lib/keyboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomSheetPickerStyles } from "./bottomSheetPickerStyles";

const SHEET_MAX_FRACTION = 0.5;
/** Grabber + title row + border — must match layout below */
const SHEET_HEADER_HEIGHT = 88;
const KEYBOARD_GAP = -5;

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxHeightFraction?: number;
  bodyScrollEnabled?: boolean;
  bodyContentContainerStyle?: StyleProp<ViewStyle>;
};

export function BottomSheetPickerModal({
  visible,
  onClose,
  title,
  children,
  maxHeightFraction = SHEET_MAX_FRACTION,
  bodyScrollEnabled = true,
  bodyContentContainerStyle,
}: Props) {
  const isAndroid = Platform.OS === "android";
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [isKeyboardOpen, setKeyboardOpen] = useState(false);
  const sheetMaxHeight = windowHeight * maxHeightFraction;
  const scrollMaxHeight = Math.max(120, sheetMaxHeight - SHEET_HEADER_HEIGHT - Math.max(insets.bottom, 8));

  const dragY = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const keyboardInsetAnim = useKeyboardInset({
    gap: KEYBOARD_GAP,
    useNativeDriver: true,
    enabled: !isAndroid,
    onKeyboardChange: (_keyboardTop, keyboardHeight) => {
      if (!isAndroid) {
        setKeyboardOpen(keyboardHeight > 0);
      }
    },
  });

  const metricsRef = useRef({ windowHeight, sheetMaxHeight });
  metricsRef.current = { windowHeight, sheetMaxHeight };
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) dragY.value = 0;
  }, [dragY, visible]);

  const finishClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  const handlePanEnd = useCallback(
    (dy: number, vy: number) => {
      const { windowHeight: wh, sheetMaxHeight: smh } = metricsRef.current;
      const threshold = Math.min(100, smh * 0.2);
      if (dy > threshold || vy > 450) {
        dragY.value = withTiming(wh, { duration: 240 }, (finished) => {
          if (finished) runOnJS(finishClose)();
        });
      } else {
        dragY.value = withSpring(0, { damping: 22, stiffness: 220 });
      }
    },
    [dragY, finishClose],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          dragStart.value = dragY.value;
        })
        .onUpdate((e) => {
          const next = dragStart.value + e.translationY;
          dragY.value = next > 0 ? next : 0;
        })
        .onEnd((e) => {
          runOnJS(handlePanEnd)(dragY.value, e.velocityY);
        }),
    [dragStart, dragY, handlePanEnd],
  );

  const sheetAnimatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: dragY.value - keyboardInsetAnim.value }],
    }),
    [dragY, keyboardInsetAnim],
  );

  const styles = useBottomSheetPickerStyles(sheetMaxHeight, insets.bottom, isAndroid, isKeyboardOpen);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
          accessibilityLabel="Dismiss"
        />
        <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
          <GestureDetector gesture={panGesture}>
            <View>
              <Pressable
                style={styles.grabberWrap}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close picker"
              >
                <View style={styles.grabberHit}>
                  <View style={styles.grabber} />
                </View>
              </Pressable>
              <Text style={styles.title}>{title}</Text>
            </View>
          </GestureDetector>
          <ScrollView
            style={{ maxHeight: scrollMaxHeight }}
            contentContainerStyle={bodyContentContainerStyle}
            scrollEnabled={bodyScrollEnabled}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
