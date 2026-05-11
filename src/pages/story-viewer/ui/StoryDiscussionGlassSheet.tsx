import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { navigateToAuthScreen } from "@/lib/authRequired";
import { discussionPaletteDark } from "@/pages/story-discussion/lib/discussionUiPalette";
import { StoryDiscussionPanelInner } from "@/pages/story-discussion/ui/StoryDiscussionPanelInner";

const KEYBOARD_GAP = -5;
/** Grabber + title — must stay in sync with layout below */
const CHROME_FIXED = 78;
/** Emoji row + composer — approximate; pairs with list viewport cap */
/** Panel footer (emoji + composer + safe area) — keep in sync with StoryDiscussionPanelInner */
const FOOTER_FIXED = 198;

type Props = {
  visible: boolean;
  storyId: string;
  navigation: NavigationProp<ParamListBase>;
  onDismiss: () => void;
};

export function StoryDiscussionGlassSheet({ visible, storyId, navigation, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const keyboardInsetAnim = useRef(new Animated.Value(0)).current;
  const [isKeyboardOpen, setKeyboardOpen] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const sheetMinH = windowHeight * 0.5;
  const sheetMaxH = windowHeight * 0.75;
  const maxListViewport = Math.max(80, sheetMaxH - CHROME_FIXED - FOOTER_FIXED);
  const [listContentH, setListContentH] = useState(0);

  const sheetH = useMemo(() => {
    const clippedList = Math.min(Math.max(listContentH, 0), maxListViewport);
    const natural = CHROME_FIXED + FOOTER_FIXED + clippedList;
    return Math.min(sheetMaxH, Math.max(sheetMinH, natural));
  }, [listContentH, maxListViewport, sheetMaxH, sheetMinH]);

  const metricsRef = useRef({ windowHeight, sheetH });
  metricsRef.current = { windowHeight, sheetH };

  useEffect(() => {
    const animateKeyboardInset = (toValue: number, duration?: number) => {
      Animated.timing(keyboardInsetAnim, {
        toValue,
        duration: duration ?? 250,
        useNativeDriver: true,
      }).start();
    };
    const onKeyboardFrameChange = (event: { endCoordinates: { height: number; screenY?: number }; duration?: number }) => {
      const wh = Dimensions.get("window").height;
      const keyboardTop = event.endCoordinates.screenY ?? wh - event.endCoordinates.height;
      const overlap = Math.max(0, wh - keyboardTop);
      setKeyboardOpen(overlap > 0);
      animateKeyboardInset(Math.max(0, overlap + KEYBOARD_GAP), event.duration);
    };
    const onKeyboardHide = (event?: { duration?: number }) => {
      setKeyboardOpen(false);
      animateKeyboardInset(0, event?.duration);
    };
    const showEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, onKeyboardFrameChange);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardInsetAnim]);

  useEffect(() => {
    if (visible) {
      setListContentH(0);
    }
  }, [visible, storyId]);

  useEffect(() => {
    if (visible) {
      translateY.setValue(windowHeight);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 26,
        stiffness: 280,
      }).start();
    } else {
      translateY.setValue(windowHeight);
    }
  }, [visible, translateY, windowHeight]);

  const animateCloseThenDismiss = () => {
    Keyboard.dismiss();
    const wh = metricsRef.current.windowHeight;
    Animated.timing(translateY, {
      toValue: wh,
      duration: 260,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDismissRef.current();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        const sh = metricsRef.current.sheetH;
        const threshold = Math.min(100, sh * 0.14);
        if (g.dy > threshold || g.vy > 0.45) {
          animateCloseThenDismiss();
          return;
        }
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
      },
    }),
  ).current;

  const onRequireAuth = () => {
    animateCloseThenDismiss();
    requestAnimationFrame(() => {
      navigateToAuthScreen(navigation);
    });
  };

  const composedTranslateY = Animated.add(translateY, Animated.multiply(keyboardInsetAnim, -1));

  const glassFooterBg = Platform.OS === "web" ? "rgba(28,28,30,0.92)" : "rgba(28,28,30,0.72)";

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={animateCloseThenDismiss}>
      <View style={styles.root}>
        <Pressable style={styles.backdropHit} onPress={animateCloseThenDismiss}>
          {Platform.OS === "web" ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.62)" }]} />
          ) : (
            <>
              <BlurView intensity={Platform.OS === "ios" ? 55 : 40} tint="dark" style={StyleSheet.absoluteFill} />
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
              transform: [{ translateY: composedTranslateY }],
            },
          ]}
        >
          <View style={styles.glassUnderlay}>
            <View style={[StyleSheet.absoluteFillObject, styles.glassTint]} />
          </View>
          <KeyboardAvoidingView
            style={styles.keyboardArea}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
          >
            <View {...panResponder.panHandlers}>
              <Pressable onPress={() => Keyboard.dismiss()} style={styles.grabberOuter}>
                <View style={styles.grabberInner} />
              </Pressable>
              <Text style={styles.sheetTitle}>Comments</Text>
            </View>
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
          </KeyboardAvoidingView>
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
