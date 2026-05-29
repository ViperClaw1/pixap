import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { AppPressable } from "@/shared/ui/app-pressable";

type ShowMoreButtonProps = {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  spinnerColor?: string;
};

export function ShowMoreButton({
  label,
  loading = false,
  disabled = false,
  onPress,
  style,
  textStyle,
  spinnerColor,
}: ShowMoreButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <AppPressable
      style={[style, isDisabled ? styles.disabled : null]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.65 },
});
