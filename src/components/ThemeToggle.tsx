import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/contexts/ThemeContext";

type Props = {
  size?: number;
};

/** Manual light / dark toggle (web uses document classes; RN uses ThemeContext). */
export default function ThemeToggle({ size = 22 }: Props) {
  const { isDark, setMode } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onPress={() => setMode(isDark ? "light" : "dark")}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
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
