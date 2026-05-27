import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import type { AppNavigation } from "@/app/navigation/appNavigation";
import { navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import {
  STORY_DISCUSSION_SHEET_MAX_HEIGHT_RATIO,
  STORY_DISCUSSION_SHEET_MIN_HEIGHT_RATIO,
} from "@/widgets/story-discussion-panel";

/** Grabber + panel header (title + close) — keep in sync with discussion panel layout */
const CHROME_FIXED = 72;
/** Panel footer (emoji + composer + safe area) — keep in sync with discussion panel inner */
const FOOTER_FIXED = 198;
const SHEET_MIN_HEIGHT_RATIO = STORY_DISCUSSION_SHEET_MIN_HEIGHT_RATIO;
const SHEET_MAX_HEIGHT_RATIO = STORY_DISCUSSION_SHEET_MAX_HEIGHT_RATIO;
const DISCUSSION_LIST_MIN_VIEWPORT = 80;
const SHEET_OPEN_MS = 320;
const SHEET_CLOSE_MS = 300;

export type DiscussionGlassSheetPanelProps = {
  onClose: () => void;
  onListContentSizeChange: (width: number, height: number) => void;
  onRequireAuth: () => void;
};

type Props = {
  visible: boolean;
  navigation: AppNavigation;
  onDismiss: () => void;
  children: (panelProps: DiscussionGlassSheetPanelProps) => ReactNode;
};

export function DiscussionGlassSheet({ visible, navigation, onDismiss, children }: Props) {
  const { height: windowHeight } = useWindowDimensions();

  const [renderModal, setRenderModal] = useState(false);
  const isClosingRef = useRef(false);
  const closeFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissWindowHeightRef = useRef(windowHeight);
  const sheetTranslate = useSharedValue(windowHeight);
  const backdropOpacity = useSharedValue(0);
  const panStart = useSharedValue(0);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const clearCloseFallback = useCallback(() => {
    if (closeFallbackTimerRef.current) {
      clearTimeout(closeFallbackTimerRef.current);
      closeFallbackTimerRef.current = null;
    }
  }, []);

  const sheetMinH = windowHeight * SHEET_MIN_HEIGHT_RATIO;
  const sheetMaxH = windowHeight * SHEET_MAX_HEIGHT_RATIO;
  const maxListViewport = Math.max(DISCUSSION_LIST_MIN_VIEWPORT, sheetMaxH - CHROME_FIXED - FOOTER_FIXED);
  const [listContentH, setListContentH] = useState(0);

  const sheetH = useMemo(() => {
    const clippedList = Math.min(Math.max(listContentH, 0), maxListViewport);
    const natural = CHROME_FIXED + FOOTER_FIXED + clippedList;
    return Math.min(sheetMaxH, Math.max(sheetMinH, natural));
  }, [listContentH, maxListViewport, sheetMaxH, sheetMinH]);

  const metricsRef = useRef({ windowHeight, sheetH });
  metricsRef.current = { windowHeight, sheetH };

  const runDismiss = useCallback(() => {
    onDismissRef.current();
  }, []);

  const finishClose = useCallback(() => {
    if (!isClosingRef.current) return;
    clearCloseFallback();
    isClosingRef.current = false;
    setRenderModal(false);
    runDismiss();
  }, [clearCloseFallback, runDismiss]);

  const openSheet = useCallback(() => {
    clearCloseFallback();
    isClosingRef.current = false;
    dismissWindowHeightRef.current = windowHeight;
    setRenderModal(true);
    setListContentH(0);
    backdropOpacity.value = 0;
    sheetTranslate.value = windowHeight;
    backdropOpacity.value = withTiming(1, {
      duration: SHEET_OPEN_MS,
      easing: Easing.out(Easing.cubic),
    });
    sheetTranslate.value = withSpring(0, { damping: 26, stiffness: 280 });
  }, [backdropOpacity, clearCloseFallback, sheetTranslate, windowHeight]);

  const animateCloseThenDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Keyboard.dismiss();
    cancelAnimation(sheetTranslate);
    cancelAnimation(backdropOpacity);
    const { sheetH: sh, windowHeight: wh } = metricsRef.current;
    const dismissY = Math.max(dismissWindowHeightRef.current, wh, sh + 64);
    backdropOpacity.value = withTiming(0, {
      duration: SHEET_CLOSE_MS,
      easing: Easing.in(Easing.cubic),
    });
    sheetTranslate.value = withTiming(
      dismissY,
      { duration: SHEET_CLOSE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      },
    );
    clearCloseFallback();
    closeFallbackTimerRef.current = setTimeout(() => {
      closeFallbackTimerRef.current = null;
      finishClose();
    }, SHEET_CLOSE_MS + 80);
  }, [backdropOpacity, clearCloseFallback, finishClose, sheetTranslate]);

  useEffect(() => () => clearCloseFallback(), [clearCloseFallback]);

  useEffect(() => {
    if (visible) {
      openSheet();
      return;
    }
    if (renderModal && !isClosingRef.current) {
      animateCloseThenDismiss();
    }
  }, [animateCloseThenDismiss, openSheet, renderModal, visible]);

  const handlePanEnd = useCallback(
    (dy: number, vy: number) => {
      const sh = metricsRef.current.sheetH;
      const threshold = Math.min(100, sh * 0.14);
      if (dy > threshold || vy > 450) {
        animateCloseThenDismiss();
        return;
      }
      sheetTranslate.value = withSpring(0, { damping: 22, stiffness: 220 });
    },
    [animateCloseThenDismiss, sheetTranslate],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          panStart.value = sheetTranslate.value;
        })
        .onUpdate((e) => {
          const next = panStart.value + e.translationY;
          sheetTranslate.value = next > 0 ? next : 0;
        })
        .onEnd((e) => {
          runOnJS(handlePanEnd)(sheetTranslate.value, e.velocityY);
        }),
    [handlePanEnd, panStart, sheetTranslate],
  );

  const onRequireAuth = useCallback(() => {
    animateCloseThenDismiss();
    requestAnimationFrame(() => {
      navigateToAuthScreen(navigation);
    });
  }, [animateCloseThenDismiss, navigation]);

  const sheetAnimatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: sheetTranslate.value }],
    }),
    [sheetTranslate],
  );

  const backdropAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: backdropOpacity.value,
    }),
    [backdropOpacity],
  );

  const sheetGrabber = (
    <Pressable onPress={() => Keyboard.dismiss()} style={styles.grabberOuter}>
      <View style={styles.grabberInner} />
    </Pressable>
  );

  const panelProps = useMemo<DiscussionGlassSheetPanelProps>(
    () => ({
      onClose: animateCloseThenDismiss,
      onListContentSizeChange: setListContentH,
      onRequireAuth,
    }),
    [animateCloseThenDismiss, onRequireAuth],
  );

  const sheetChrome = (
    <View style={styles.keyboardArea}>
      <GestureDetector gesture={panGesture}>{sheetGrabber}</GestureDetector>
      <View style={styles.innerClip}>{children(panelProps)}</View>
    </View>
  );

  const modalBody = (
    <View style={styles.root}>
      <Animated.View style={[styles.backdropHit, backdropAnimatedStyle]} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={animateCloseThenDismiss}>
          <View style={[StyleSheet.absoluteFill, styles.backdropDim]} />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetH,
            maxHeight: sheetMaxH,
          },
          sheetAnimatedStyle,
        ]}
      >
        <View style={styles.glassUnderlay} pointerEvents="none">
          {Platform.OS === "web" ? (
            <View style={[StyleSheet.absoluteFillObject, styles.glassFallback]} />
          ) : (
            <BlurView
              intensity={Platform.OS === "ios" ? 55 : 56}
              tint="dark"
              style={StyleSheet.absoluteFillObject}
              {...(Platform.OS === "android"
                ? { experimentalBlurMethod: "dimezisBlurView" as const, blurReductionFactor: 3.5 }
                : {})}
            />
          )}
          <View style={[StyleSheet.absoluteFillObject, styles.glassTint]} />
        </View>
        {sheetChrome}
      </Animated.View>
    </View>
  );

  const modalContent =
    Platform.OS === "android" ? (
      <GestureHandlerRootView style={styles.modalRoot}>{modalBody}</GestureHandlerRootView>
    ) : (
      modalBody
    );

  return (
    <Modal
      visible={renderModal}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={animateCloseThenDismiss}
    >
      {modalContent}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropHit: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropDim: {
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    position: "relative",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    width: "100%",
  },
  glassUnderlay: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
    zIndex: 0,
  },
  glassFallback: {
    backgroundColor: "rgba(28,28,30,0.92)",
  },
  glassTint: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  keyboardArea: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  innerClip: {
    flex: 1,
    minHeight: 0,
  },
  grabberOuter: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabberInner: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});
