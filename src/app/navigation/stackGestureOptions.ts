import { Platform } from "react-native";

/**
 * Browse/detail pushes (Home → PlaceDetail → BookingFlow, …).
 *
 * iOS: edge-only back swipe — `fullScreenGestureEnabled` lets one continuous swipe
 * chain pops and re-focus PlaceDetail with a visible flash.
 *
 * Android: native stack gestures are unreliable; screens use `useAndroidFullSwipeBackPanHandlers`.
 */
export const browseFlowSwipeBackOptions = {
  gestureEnabled: Platform.OS === "ios",
  fullScreenGestureEnabled: false,
} as const;

/** Screens that may sit under another push (e.g. PlaceDetail under BookingFlow) during interactive pop. */
export const browseFlowUnderlayScreenOptions = {
  ...browseFlowSwipeBackOptions,
  freezeOnBlur: false,
} as const;

export const fullWidthSwipeBackOptions = {
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
} as const;
