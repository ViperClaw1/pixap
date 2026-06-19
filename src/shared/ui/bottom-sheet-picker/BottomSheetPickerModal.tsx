import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  type ViewStyle,
  View,
} from "react-native";
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
  /** Pinned below the scroll area (e.g. comment composer). */
  footer?: ReactNode;
  maxHeightFraction?: number;
  /** Minimum sheet height when fitContent (e.g. 0.5 = 50vh). */
  minHeightFraction?: number;
  /** Sheet height follows measured body + header + footer, capped at maxHeightFraction. */
  fitContent?: boolean;
  bodyScrollEnabled?: boolean;
  /** Keeps ScrollView mounted but disables scrolling (nested lists on Android). */
  parentScrollActive?: boolean;
  bodyContentContainerStyle?: StyleProp<ViewStyle>;
  /** Optional top gap that caps keyboard lift so the sheet stays inside the viewport. */
  keyboardTopGap?: number;
  /** Android: treat keyboard overlap via inset even when adjustResize shrinks the window. */
  keyboardInsetIgnoreWindowResize?: boolean;
  /** Rendered above sheet + backdrop (e.g. inline alerts while sheet stays open). */
  overlay?: ReactNode;
};

export function BottomSheetPickerModal({
  visible,
  onClose,
  title,
  children,
  footer,
  maxHeightFraction = SHEET_MAX_FRACTION,
  minHeightFraction,
  fitContent = false,
  bodyScrollEnabled = true,
  parentScrollActive = true,
  bodyContentContainerStyle,
  keyboardTopGap,
  keyboardInsetIgnoreWindowResize = false,
  overlay,
}: Props) {
  const isAndroid = Platform.OS === "android";
  const insets = useSafeAreaInsets();
  const [layoutWindowHeight, setLayoutWindowHeight] = useState(() => Dimensions.get("window").height);
  const [footerHeight, setFooterHeight] = useState(0);
  const [bodyContentHeight, setBodyContentHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      setLayoutWindowHeight(Dimensions.get("window").height);
    } else {
      setBodyContentHeight(0);
      setFooterHeight(0);
    }
  }, [visible]);

  const sheetMaxHeight = layoutWindowHeight * maxHeightFraction;
  const sheetMinHeight =
    fitContent && minHeightFraction != null ? layoutWindowHeight * minHeightFraction : undefined;
  const scrollMaxHeight = Math.max(
    120,
    sheetMaxHeight - SHEET_HEADER_HEIGHT - footerHeight - Math.max(insets.bottom, 8),
  );
  const sheetBottomPad = Math.max(insets.bottom, 10);
  const minBodyHeight =
    sheetMinHeight != null
      ? Math.max(0, sheetMinHeight - SHEET_HEADER_HEIGHT - footerHeight - sheetBottomPad)
      : 0;
  const hasFixedMinSheetHeight = fitContent && minHeightFraction != null && sheetMinHeight != null;
  const effectiveBodyHeight =
    fitContent && minBodyHeight > 0 ? Math.max(bodyContentHeight, minBodyHeight) : bodyContentHeight;
  const contentFitsWithoutScroll =
    fitContent && effectiveBodyHeight > 0 && effectiveBodyHeight <= scrollMaxHeight;
  const fittedSheetHeight =
    fitContent && (effectiveBodyHeight > 0 || hasFixedMinSheetHeight)
      ? hasFixedMinSheetHeight
        ? Math.min(
            sheetMaxHeight,
            Math.max(
              sheetMinHeight!,
              SHEET_HEADER_HEIGHT + effectiveBodyHeight + footerHeight + sheetBottomPad,
            ),
          )
        : contentFitsWithoutScroll
          ? Math.min(
              sheetMaxHeight,
              SHEET_HEADER_HEIGHT + effectiveBodyHeight + footerHeight + sheetBottomPad,
            )
          : sheetMaxHeight
      : undefined;
  const scrollEnabled =
    bodyScrollEnabled && parentScrollActive && (!fitContent || !contentFitsWithoutScroll);
  const mergedBodyContentContainerStyle = useMemo(
    () => [
      fitContent && minBodyHeight > 0 ? { flexGrow: 1, minHeight: minBodyHeight } : null,
      bodyContentContainerStyle,
    ],
    [bodyContentContainerStyle, fitContent, minBodyHeight],
  );
  const bodyScrollStyle = useMemo(() => {
    if (!fitContent || minBodyHeight <= 0) {
      return contentFitsWithoutScroll ? undefined : { maxHeight: scrollMaxHeight };
    }
    if (hasFixedMinSheetHeight) {
      return {
        height: effectiveBodyHeight,
        maxHeight: scrollMaxHeight,
      };
    }
    return {
      flexGrow: 1,
      flexShrink: 1,
      minHeight: minBodyHeight,
      maxHeight: contentFitsWithoutScroll ? undefined : scrollMaxHeight,
    };
  }, [
    contentFitsWithoutScroll,
    effectiveBodyHeight,
    fitContent,
    hasFixedMinSheetHeight,
    minBodyHeight,
    scrollMaxHeight,
  ]);
  const bodyInnerStyle = useMemo(() => {
    if (!fitContent || minBodyHeight <= 0) return undefined;
    if (hasFixedMinSheetHeight) {
      return { minHeight: minBodyHeight };
    }
    return { flex: 1, minHeight: minBodyHeight };
  }, [fitContent, hasFixedMinSheetHeight, minBodyHeight]);
  const bodyViewContentStyle = useMemo(
    () => [mergedBodyContentContainerStyle, bodyInnerStyle],
    [bodyInnerStyle, mergedBodyContentContainerStyle],
  );

  const handleBodyLayout = useCallback(
    (height: number) => {
      const rounded = Math.ceil(height);
      if (hasFixedMinSheetHeight && minBodyHeight > 0 && rounded <= minBodyHeight + 1) {
        setBodyContentHeight((prev) => (prev === minBodyHeight ? prev : minBodyHeight));
        return;
      }
      setBodyContentHeight((prev) => (Math.abs(rounded - prev) <= 1 ? prev : rounded));
    },
    [hasFixedMinSheetHeight, minBodyHeight],
  );

  const handleFooterLayout = useCallback((height: number) => {
    const rounded = Math.ceil(height);
    setFooterHeight((prev) => (Math.abs(rounded - prev) <= 1 ? prev : rounded));
  }, []);

  const dragY = useSharedValue(0);
  const dragStart = useSharedValue(0);

  const keyboardInsetAnim = useKeyboardInset({
    gap: KEYBOARD_GAP,
    useNativeDriver: true,
    ignoreWindowResize: keyboardInsetIgnoreWindowResize,
  });

  const metricsRef = useRef({ windowHeight: layoutWindowHeight, sheetMaxHeight });
  metricsRef.current = { windowHeight: layoutWindowHeight, sheetMaxHeight };
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

  const sheetHeightForKeyboardLift = fittedSheetHeight ?? sheetMaxHeight;
  const keyboardLiftCap =
    keyboardTopGap == null ? null : Math.max(0, layoutWindowHeight - sheetHeightForKeyboardLift - keyboardTopGap);

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
    () => {
      const keyboardLift =
        keyboardLiftCap == null ? keyboardInsetAnim.value : Math.min(keyboardInsetAnim.value, keyboardLiftCap);
      return {
        transform: [{ translateY: dragY.value - keyboardLift }],
      };
    },
    [dragY, keyboardInsetAnim, keyboardLiftCap],
  );

  const styles = useBottomSheetPickerStyles(
    sheetMaxHeight,
    insets.bottom,
    isAndroid,
    fittedSheetHeight,
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent={isAndroid}
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
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
          {bodyScrollEnabled ? (
            <ScrollView
              style={bodyScrollStyle}
              contentContainerStyle={mergedBodyContentContainerStyle}
              scrollEnabled={scrollEnabled}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={!contentFitsWithoutScroll}
            >
              <View
                style={bodyInnerStyle}
                onLayout={
                  fitContent
                    ? (e) => {
                        handleBodyLayout(e.nativeEvent.layout.height);
                      }
                    : undefined
                }
              >
                {children}
              </View>
            </ScrollView>
          ) : (
            <View style={bodyScrollStyle}>
              <View
                style={bodyViewContentStyle}
                onLayout={
                  fitContent
                    ? (e) => {
                        handleBodyLayout(e.nativeEvent.layout.height);
                      }
                    : undefined
                }
              >
                {children}
              </View>
            </View>
          )}
          {footer ? (
            <View
              onLayout={(e) => {
                handleFooterLayout(e.nativeEvent.layout.height);
              }}
            >
              {footer}
            </View>
          ) : null}
        </Animated.View>
        {overlay ? <View style={overlayHostStyle.overlayHost}>{overlay}</View> : null}
      </View>
    </Modal>
  );
}

const overlayHostStyle = StyleSheet.create({
  overlayHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
  },
});
