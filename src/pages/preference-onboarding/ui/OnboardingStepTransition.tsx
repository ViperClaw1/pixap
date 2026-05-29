import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const ENTER_DURATION_MS = 280;
const EXIT_DURATION_MS = 220;
const SWIPE_COMMIT_RATIO = 0.22;
const SWIPE_VELOCITY = 420;
const RUBBER_BAND = 0.32;

type Props = {
  stepKey: string;
  /** 1 = forward (enter from right), -1 = back (enter from left) */
  direction: 1 | -1;
  canSwipeForward: boolean;
  canSwipeBack: boolean;
  enableSwipe?: boolean;
  onSwipeForward: () => void;
  onSwipeBack: () => void;
  children: ReactNode;
};

export function OnboardingStepTransition({
  stepKey,
  direction,
  canSwipeForward,
  canSwipeBack,
  enableSwipe = true,
  onSwipeForward,
  onSwipeBack,
  children,
}: Props) {
  const { width } = useStaticWindowSize();
  const translateX = useSharedValue(0);
  const isExiting = useSharedValue(false);
  const mountedStepRef = useRef<string | null>(null);

  useEffect(() => {
    isExiting.value = false;
    if (mountedStepRef.current === null) {
      mountedStepRef.current = stepKey;
      translateX.value = 0;
      return;
    }
    if (mountedStepRef.current === stepKey) return;
    mountedStepRef.current = stepKey;

    const from = direction * width;
    translateX.value = from;
    translateX.value = withTiming(0, {
      duration: ENTER_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [stepKey, direction, width, isExiting, translateX]);

  const panGesture = Gesture.Pan()
    .enabled(enableSwipe)
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      if (isExiting.value) return;
      const tx = e.translationX;
      if (tx < 0 && !canSwipeForward) {
        translateX.value = tx * RUBBER_BAND;
        return;
      }
      if (tx > 0 && !canSwipeBack) {
        translateX.value = tx * RUBBER_BAND;
        return;
      }
      translateX.value = tx;
    })
    .onEnd((e) => {
      if (isExiting.value) return;
      const threshold = width * SWIPE_COMMIT_RATIO;
      const goForward =
        canSwipeForward &&
        (e.translationX < -threshold || e.velocityX < -SWIPE_VELOCITY);
      const goBack =
        canSwipeBack && (e.translationX > threshold || e.velocityX > SWIPE_VELOCITY);

      if (goForward) {
        isExiting.value = true;
        translateX.value = withTiming(-width, { duration: EXIT_DURATION_MS }, (finished) => {
          if (finished) runOnJS(onSwipeForward)();
        });
        return;
      }
      if (goBack) {
        isExiting.value = true;
        translateX.value = withTiming(width, { duration: EXIT_DURATION_MS }, (finished) => {
          if (finished) runOnJS(onSwipeBack)();
        });
        return;
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 280 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, animatedStyle]} key={stepKey}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
});
