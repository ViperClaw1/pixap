import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";

type Props = {
  size?: number;
  /** Merged after base hit area (e.g. home header chip matching bell / language). */
  style?: StyleProp<ViewStyle>;
};

/** Manual light / dark toggle (web uses document classes; RN uses ThemeContext). */
export default function ThemeToggle({ size = 22, style }: Props) {
  const { isDark, setMode } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onPress={() => setMode(isDark ? "light" : "dark")}
      style={({ pressed }) => [styles.hit, style, pressed && styles.pressed]}
    >
      <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={size} color={isDark ? "#fbbf24" : "#1e3a5f"} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    padding: 8,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.7,
  },
});
