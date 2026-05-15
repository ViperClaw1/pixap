import type { TextStyle, ViewStyle } from "react-native";
import { lightColors } from "@/shared/theme/palettes";

export const AUTH_PRIMARY_COLOR = lightColors.accent;
export const SHARED_PRESSABLE_HEIGHT = 56;
export const SHARED_PRESSABLE_RADIUS = 18;

export const primaryPressableStyle: ViewStyle = {
  backgroundColor: AUTH_PRIMARY_COLOR,
  minHeight: SHARED_PRESSABLE_HEIGHT,
  borderRadius: SHARED_PRESSABLE_RADIUS,
  alignItems: "center",
  justifyContent: "center",
};

export const primaryPressableTextStyle: TextStyle = {
  color: "#fff",
  fontWeight: "700",
  fontSize: 16,
  lineHeight: 32,
};
