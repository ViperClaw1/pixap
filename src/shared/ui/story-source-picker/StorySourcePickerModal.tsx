import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useAppTheme } from "@/contexts/ThemeContext";

export type StorySourceOption = "camera" | "gallery";

type Props = {
  visible: boolean;
  onClose: () => void;
  onChoose: (source: StorySourceOption) => void;
};

export function StorySourcePickerModal({ visible, onClose, onChoose }: Props) {
  const { colors } = useAppTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [opacity, visible]);

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

  if (!visible) return null;

  return (
    <GestureDetector gesture={swipeToCloseGesture}>
      <Animated.View style={[styles.safeArea, { opacity }]}>
        <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.48)" }]}>
          <Pressable style={styles.outsideTapArea} onPress={onClose} />
          <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Add story</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Choose where to pick media from for your story.
            </Text>
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
                    onPress={() => onChoose(option.id)}
                  >
                    <Ionicons name={option.icon} size={24} color={colors.text} />
                    <Text style={[styles.optionText, { color: colors.text }]}>{option.title}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  outsideTapArea: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    zIndex: 1,
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
