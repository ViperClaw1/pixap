import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/contexts/ThemeContext";

type AppHeaderProps = {
  title: string;
  leftIcon: keyof typeof Ionicons.glyphMap;
  onLeftPress: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
};

function AppHeaderComponent({ title, leftIcon, onLeftPress, rightIcon, onRightPress }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 10), borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      <View style={styles.row}>
        <Pressable style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={onLeftPress}>
          <Ionicons name={leftIcon} size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {rightIcon && onRightPress ? (
          <Pressable style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={onRightPress}>
            <Ionicons name={rightIcon} size={20} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.iconBtnPlaceholder} />
        )}
      </View>
    </View>
  );
}

export const AppHeader = memo(AppHeaderComponent);

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  iconBtnPlaceholder: {
    width: 34,
    height: 34,
  },
  title: {
    position: "absolute",
    left: 56,
    right: 56,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
});
