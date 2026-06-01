import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useAppTheme } from "@/app/providers/ThemeProvider";

export type StorySourceOption = "camera" | "gallery";

/** iOS cannot present UIImagePicker while our Modal is still on screen. */
const PICKER_PRESENT_DELAY_MS = Platform.OS === "ios" ? 400 : 250;
const FADE_IN_MS = 220;
const FADE_OUT_MS = 200;

type Props = {
  visible: boolean;
  onClose: () => void;
  onChoose: (source: StorySourceOption) => void;
  title?: string;
  subtitle?: string;
};

export function StorySourcePickerModal({
  visible,
  onClose,
  onChoose,
  title = "Add story",
  subtitle = "Choose where to pick media from for your story.",
}: Props) {
  const { colors } = useAppTheme();
  const [mounted, setMounted] = useState(false);
  const opacity = useSharedValue(0);
  const chooseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      opacity.value = withTiming(1, {
        duration: FADE_IN_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }
    if (!mounted) return;
    opacity.value = withTiming(
      0,
      {
        duration: FADE_OUT_MS,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      },
    );
  }, [mounted, opacity, visible]);

  useEffect(() => {
    return () => {
      if (chooseTimerRef.current != null) {
        clearTimeout(chooseTimerRef.current);
      }
    };
  }, []);

  const handleChoose = useCallback(
    (source: StorySourceOption) => {
      onClose();
      if (chooseTimerRef.current != null) {
        clearTimeout(chooseTimerRef.current);
      }
      chooseTimerRef.current = setTimeout(() => {
        chooseTimerRef.current = null;
        onChoose(source);
      }, PICKER_PRESENT_DELAY_MS);
    },
    [onChoose, onClose],
  );

  const overlayStyle = useAnimatedStyle(
    () => ({
      opacity: opacity.value,
    }),
    [opacity],
  );

  const swipeToCloseGesture = useMemo(
    () =>
      Gesture.Pan().onEnd((event) => {
        if (event.translationX < -60) {
          runOnJS(onClose)();
        }
      }),
    [onClose],
  );

  const options = useMemo(
    () => [
      {
        id: "camera" as const,
        title: "Choose from camera",
        icon: "camera-outline" as const,
      },
      {
        id: "gallery" as const,
        title: "Choose from gallery",
        icon: "images-outline" as const,
      },
    ],
    [],
  );

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureDetector gesture={swipeToCloseGesture}>
        <Animated.View style={[styles.overlayRoot, overlayStyle]} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
          <View
            style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}
            accessibilityViewIsModal
          >
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
            <View style={styles.options}>
              {options.map((option) => {
                return (
                  <Pressable
                    key={`story-source-${option.id}`}
                    style={[
                      styles.optionCard,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                    onPress={() => handleChoose(option.id)}
                  >
                    <Ionicons name={option.icon} size={24} color={colors.text} />
                    <Text style={[styles.optionText, { color: colors.text }]}>{option.title}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  options: {
    gap: 10,
  },
  optionCard: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
