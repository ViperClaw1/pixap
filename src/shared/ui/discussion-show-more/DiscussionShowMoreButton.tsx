import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import type { DiscussionUiPalette } from "@/shared/theme/discussionPalette";

type Props = {
  label: string;
  onPress: () => void;
  palette: DiscussionUiPalette;
  style?: StyleProp<ViewStyle>;
};

export function DiscussionShowMoreButton({ label, onPress, palette, style }: Props) {
  return (
    <Pressable
      hitSlop={6}
      onPress={onPress}
      style={[styles.row, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.label, { color: palette.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
