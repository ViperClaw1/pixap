import { Platform, Pressable, type PressableProps } from "react-native";

const ANDROID_RIPPLE = { color: "rgba(0,0,0,0.08)", borderless: false } as const;

export function AppPressable({ android_ripple, ...props }: PressableProps) {
  return (
    <Pressable
      android_ripple={Platform.OS === "android" ? (android_ripple ?? ANDROID_RIPPLE) : undefined}
      {...props}
    />
  );
}
