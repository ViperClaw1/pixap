import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
import { useKeyboardInset } from "@/shared/lib/keyboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import type { AppNavigation } from "@/app/navigation/appNavigation";
import { navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import { discussionPaletteDark } from "@/shared/theme/discussionPalette";
import {
  STORY_DISCUSSION_SHEET_MAX_HEIGHT_RATIO,
  STORY_DISCUSSION_SHEET_MIN_HEIGHT_RATIO,
  StoryDiscussionPanelInner,
} from "@/widgets/story-discussion-panel";

const KEYBOARD_GAP = -5;
/** Grabber + panel header (title + close) — keep in sync with layout below */
const CHROME_FIXED = 72;
/** Panel footer (emoji + composer + safe area) — keep in sync with StoryDiscussionPanelInner */
const FOOTER_FIXED = 198;
const SHEET_MIN_HEIGHT_RATIO = STORY_DISCUSSION_SHEET_MIN_HEIGHT_RATIO;
const SHEET_MAX_HEIGHT_RATIO = STORY_DISCUSSION_SHEET_MAX_HEIGHT_RATIO;
const DISCUSSION_LIST_MIN_VIEWPORT = 80;
const SHEET_OPEN_MS = 320;
const SHEET_CLOSE_MS = 300;

type Props = {
  visible: boolean;
  storyId: string;
  navigation: AppNavigation;
  onDismiss: () => void;
};

export function StoryDiscussionGlassSheet({ visible, storyId, navigation, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [isKeyboardOpen, setKeyboardOpen] = useState(false);
  const keyboardInsetAnim = useKeyboardInset({
    gap: KEYBOARD_GAP,
    useNativeDriver: true,
    onKeyboardChange: (_keyboardTop, keyboardHeight) => {
      setKeyboardOpen(keyboardHeight > 0);
    },
  });

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
    keyboardInsetAnim.value = 0;
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
  }, [backdropOpacity, clearCloseFallback, finishClose, keyboardInsetAnim, sheetTranslate]);

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

  const onRequireAuth = () => {
    animateCloseThenDismiss();
    requestAnimationFrame(() => {
      navigateToAuthScreen(navigation);
    });
  };

  const sheetAnimatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: sheetTranslate.value - keyboardInsetAnim.value }],
    }),
    [keyboardInsetAnim, sheetTranslate],
  );

  const backdropAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: backdropOpacity.value,
    }),
    [backdropOpacity],
  );

  const glassFooterBg = Platform.OS === "web" ? "rgba(28,28,30,0.92)" : "rgba(28,28,30,0.72)";

  const sheetGrabber = (
    <Pressable onPress={() => Keyboard.dismiss()} style={styles.grabberOuter}>
      <View style={styles.grabberInner} />
    </Pressable>
  );

  const sheetChrome = (
    <View style={styles.keyboardArea}>
      {Platform.OS === "ios" ? <GestureDetector gesture={panGesture}>{sheetGrabber}</GestureDetector> : sheetGrabber}
      <View style={styles.innerClip}>
        <StoryDiscussionPanelInner
          storyId={storyId}
          onRequireAuth={onRequireAuth}
          onClose={animateCloseThenDismiss}
          discussionPalette={discussionPaletteDark}
          footerBackgroundColor={glassFooterBg}
          footerBorderColor="rgba(255,255,255,0.12)"
          onListContentSizeChange={(_w, h) => setListContentH(h)}
        />
      </View>
    </View>
  );

  const modalBody = (
    <View style={styles.root}>
      <Animated.View style={[styles.backdropHit, backdropAnimatedStyle]} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={animateCloseThenDismiss}>
          {Platform.OS === "web" ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.62)" }]} />
          ) : (
            <>
              <BlurView
                intensity={Platform.OS === "ios" ? 55 : 56}
                tint="dark"
                style={StyleSheet.absoluteFill}
                {...(Platform.OS === "android"
                  ? { experimentalBlurMethod: "dimezisBlurView" as const, blurReductionFactor: 3.5 }
                  : {})}
              />
              <View style={[StyleSheet.absoluteFill, styles.dimOverlay]} pointerEvents="none" />
            </>
          )}
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetH,
            maxHeight: sheetMaxH,
            paddingBottom: Platform.OS === "android" ? 0 : isKeyboardOpen ? 0 : Math.max(insets.bottom, 10),
          },
          sheetAnimatedStyle,
        ]}
      >
        <View style={styles.glassUnderlay}>
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
  dimOverlay: {
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  sheet: {
    position: "relative",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    backgroundColor: "rgba(32,32,34,0.55)",
    width: "100%",
  },
  glassUnderlay: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
    zIndex: 0,
    pointerEvents: "none",
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
