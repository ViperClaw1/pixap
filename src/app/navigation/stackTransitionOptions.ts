import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Platform } from "react-native";
import { IOS_STACK_MODAL_ANIMATION_DURATION_MS } from "./stackTransitionDurations";

/** Default push between stack screens (Home → PlaceDetail, Profile → EditProfile, …). */
export const nativeStackPushScreenOptions = {
  headerShown: false,
  animation: "slide_from_right",
  freezeOnBlur: true,
} satisfies NativeStackNavigationOptions;

/** Messaging stack: avoid react-freeze jank when returning from thread / switching tabs on Android. */
export const nativeStackCartScreenOptions = {
  ...nativeStackPushScreenOptions,
  freezeOnBlur: false,
} satisfies NativeStackNavigationOptions;

export function mergeNativeStackScreenOptions(
  overrides: NativeStackNavigationOptions,
): NativeStackNavigationOptions {
  return { ...nativeStackPushScreenOptions, ...overrides };
}

const iosModalAnimationDuration =
  Platform.OS === "ios" ? { animationDuration: IOS_STACK_MODAL_ANIMATION_DURATION_MS } : {};

/** Bottom sheet style modals (discussions, etc.). */
export const nativeStackModalFromBottomScreenOptions = {
  presentation: "modal",
  animation: "slide_from_bottom",
  headerShown: false,
  freezeOnBlur: false,
  ...iosModalAnimationDuration,
} satisfies NativeStackNavigationOptions;

/**
 * Story viewer overlay: keeps the screen below mounted (`transparentModal`).
 * Custom pan dismiss in StoryViewer / FeedStoryViewer — native swipe conflicts with JS translateY.
 */
export const nativeStackStoryOverlayModalOptions = {
  presentation: "transparentModal" as const,
  freezeOnBlur: false as const,
  gestureEnabled: false,
  animation: "fade" as const,
  contentStyle: { backgroundColor: "transparent" },
} satisfies NativeStackNavigationOptions;
