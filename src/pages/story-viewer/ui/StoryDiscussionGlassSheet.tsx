import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useKeyboardInset } from "@/shared/lib/keyboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import type { AppNavigation } from "@/app/navigation/appNavigation";
import { navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import { discussionPaletteDark } from "@/shared/theme/discussionPalette";
import { StoryDiscussionPanelInner } from "@/widgets/story-discussion-panel";

const KEYBOARD_GAP = -5;
/** Grabber + title — must stay in sync with layout below */
const CHROME_FIXED = 78;
/** Panel footer (emoji + composer + safe area) — keep in sync with StoryDiscussionPanelInner */
const FOOTER_FIXED = 198;
const SHEET_MIN_HEIGHT_RATIO = 0.5;
const SHEET_MAX_HEIGHT_RATIO = 0.75;
const DISCUSSION_LIST_MIN_VIEWPORT = 80;

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

  const sheetTranslate = useSharedValue(windowHeight);
  const panStart = useSharedValue(0);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

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

  useEffect(() => {
    if (visible) {
      setListContentH(0);
    }
  }, [visible, storyId]);

  useEffect(() => {
    if (visible) {
      sheetTranslate.value = windowHeight;
      sheetTranslate.value = withSpring(0, { damping: 26, stiffness: 280 });
    } else {
      sheetTranslate.value = windowHeight;
    }
  }, [sheetTranslate, visible, windowHeight]);

  const runDismiss = useCallback(() => {
    onDismissRef.current();
  }, []);

  const animateCloseThenDismiss = useCallback(() => {
    Keyboard.dismiss();
    const wh = metricsRef.current.windowHeight;
    sheetTranslate.value = withTiming(wh, { duration: 260 }, (finished) => {
      if (finished) runOnJS(runDismiss)();
    });
  }, [runDismiss, sheetTranslate]);

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

  const glassFooterBg = Platform.OS === "web" ? "rgba(28,28,30,0.92)" : "rgba(28,28,30,0.72)";

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={animateCloseThenDismiss}>
      <View style={styles.root}>
        <Pressable style={styles.backdropHit} onPress={animateCloseThenDismiss}>
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

        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetH,
              maxHeight: sheetMaxH,
              paddingBottom: isKeyboardOpen ? 0 : Math.max(insets.bottom, 10),
            },
            sheetAnimatedStyle,
          ]}
        >
          <View style={styles.glassUnderlay}>
            <View style={[StyleSheet.absoluteFillObject, styles.glassTint]} />
          </View>
          <View style={styles.keyboardArea}>
            <GestureDetector gesture={panGesture}>
              <View>
                <Pressable onPress={() => Keyboard.dismiss()} style={styles.grabberOuter}>
                  <View style={styles.grabberInner} />
                </Pressable>
                <Text style={styles.sheetTitle}>Comments</Text>
              </View>
            </GestureDetector>
            <View style={styles.innerClip}>
              <StoryDiscussionPanelInner
                storyId={storyId}
                onRequireAuth={onRequireAuth}
                discussionPalette={discussionPaletteDark}
                footerBackgroundColor={glassFooterBg}
                footerBorderColor="rgba(255,255,255,0.12)"
                onListContentSizeChange={(_w, h) => setListContentH(h)}
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  sheetTitle: {
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
});
