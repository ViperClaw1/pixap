import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  isCheckingIn?: boolean;
  spinnerColor: string;
  buttonStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  rippleToken?: number;
};

export function CrowdCheckInButton({
  label,
  onPress,
  disabled,
  isCheckingIn,
  spinnerColor,
  buttonStyle,
  textStyle,
  rippleToken = 0,
}: Props) {
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!rippleToken) return;
    ripple.setValue(0);
    Animated.timing(ripple, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [ripple, rippleToken]);

  const rippleStyle = {
    transform: [
      {
        scale: ripple.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 3],
        }),
      },
    ],
    opacity: ripple.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.5, 0.3, 0],
    }),
  };

  return (
    <View style={styles.wrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.ripple, rippleStyle, buttonStyle]}
      />
      <Pressable
        style={[buttonStyle, (disabled || isCheckingIn) && { opacity: 0.65 }]}
        onPress={onPress}
        disabled={disabled || isCheckingIn}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || isCheckingIn, busy: isCheckingIn }}
      >
        {isCheckingIn ? (
          <ActivityIndicator size="small" color={spinnerColor} />
        ) : (
          <Text style={textStyle}>{label}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = {
  wrap: { marginTop: 12, alignSelf: "stretch" },
  ripple: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(34,197,94,0.5)",
  },
};
