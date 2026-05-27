import { useEffect, useMemo, useRef } from "react";
import { Dimensions, Keyboard, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useKeyboardInset } from "./useKeyboardInset";

/** Matches `styles.footer.paddingTop` in discussion panels — keep in sync. */
export const DISCUSSION_FOOTER_VERTICAL_PADDING = 8;

/** Extra bottom padding on iOS (bottom = top + this). */
export const DISCUSSION_FOOTER_IOS_EXTRA_BOTTOM_PADDING = 5;

/** @deprecated Use DISCUSSION_FOOTER_VERTICAL_PADDING */
export const DISCUSSION_ANDROID_FOOTER_PADDING = DISCUSSION_FOOTER_VERTICAL_PADDING;

/** Fade out safe-area offset once keyboard lift exceeds this (px). */
const IOS_SAFE_AREA_FADE_LIFT_PX = 56;

/** Extra scroll clearance above sticky footer on iOS (px). */
export const DISCUSSION_IOS_LIST_FOOTER_CLEARANCE = 8;

/** Window height drop from adjustResize — above this, skip manual lift on Android. */
const ANDROID_RESIZE_HANDLED_THRESHOLD_PX = 48;

export type DiscussionKeyboardHost = "navigation-modal" | "glass-overlay";

export type DiscussionPanelFooterKeyboardOptions = {
  host?: DiscussionKeyboardHost;
};

/**
 * Discussion composer keyboard handling.
 * - iOS navigation modal: sticky footer + window keyboard inset.
 * - Android navigation modal: flex footer; root padding only when window does not resize.
 * - Glass overlay: iOS sticky; Android root padding.
 */
export function useDiscussionPanelFooterKeyboard(
  isActive = true,
  options: DiscussionPanelFooterKeyboardOptions = {},
) {
  const { host = "navigation-modal" } = options;
  const insets = useSafeAreaInsets();

  const footerPaddingBottom = useMemo(
    () =>
      Platform.OS === "ios"
        ? DISCUSSION_FOOTER_VERTICAL_PADDING + DISCUSSION_FOOTER_IOS_EXTRA_BOTTOM_PADDING
        : DISCUSSION_FOOTER_VERTICAL_PADDING,
    [],
  );

  const useNavigationModalLift = isActive && host === "navigation-modal";
  const useAndroidGlassLift = isActive && Platform.OS === "android" && host === "glass-overlay";
  const useIosGlassSticky = isActive && Platform.OS === "ios" && host === "glass-overlay";
  const useIosNavigationSticky = useNavigationModalLift && Platform.OS === "ios";
  const useStickyFooter = useIosNavigationSticky || useIosGlassSticky;

  const navigationModalInset = useKeyboardInset({
    enabled: useNavigationModalLift,
    gap: 0,
    ignoreWindowResize: false,
  });

  const iosGlassInset = useKeyboardInset({
    enabled: useIosGlassSticky,
    gap: 0,
    ignoreWindowResize: false,
  });

  const androidShrinkTrim = useSharedValue(0);
  const baselineWindowHeightRef = useRef(Dimensions.get("window").height);

  useEffect(() => {
    if (!useNavigationModalLift || Platform.OS !== "android") {
      return undefined;
    }

    const syncBaseline = () => {
      baselineWindowHeightRef.current = Dimensions.get("window").height;
    };

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      syncBaseline();
      androidShrinkTrim.value = 0;
    });

    const dimSub = Dimensions.addEventListener("change", ({ window }) => {
      const shrunkBy = Math.max(0, baselineWindowHeightRef.current - window.height);
      androidShrinkTrim.value = shrunkBy;
    });

    return () => {
      hideSub.remove();
      dimSub.remove();
    };
  }, [androidShrinkTrim, useNavigationModalLift]);

  const androidNavigationPadding = useDerivedValue(() => {
    if (!useNavigationModalLift || Platform.OS !== "android") {
      return 0;
    }
    if (androidShrinkTrim.value >= ANDROID_RESIZE_HANDLED_THRESHOLD_PX) {
      return 0;
    }
    return navigationModalInset.value;
  });

  const composerStickyInset: SharedValue<number> | undefined = useIosNavigationSticky
    ? navigationModalInset
    : useIosGlassSticky
      ? iosGlassInset
      : undefined;

  const androidGlassInset = useKeyboardInset({
    enabled: useAndroidGlassLift,
    gap: 0,
    ignoreWindowResize: true,
  });

  const iosStickyFooterPaddingStyle = useAnimatedStyle(() => {
    if (!useStickyFooter) {
      return {};
    }
    const lift = useIosNavigationSticky
      ? navigationModalInset.value
      : useIosGlassSticky
        ? iosGlassInset.value
        : 0;
    const fade = Math.min(1, lift / IOS_SAFE_AREA_FADE_LIFT_PX);
    return {
      paddingBottom: footerPaddingBottom + insets.bottom * (1 - fade),
    };
  });

  const rootLiftStyle = useAnimatedStyle(() => {
    if (Platform.OS === "android") {
      if (useAndroidGlassLift) {
        return { paddingBottom: androidGlassInset.value };
      }
      if (useNavigationModalLift) {
        return { paddingBottom: androidNavigationPadding.value };
      }
    }
    return { paddingBottom: 0 };
  });

  return {
    RootOuter: Animated.View,
    rootLiftStyle,
    footerPaddingBottom,
    useStickyFooter,
    composerStickyInset,
    iosStickyFooterPaddingStyle: useStickyFooter ? iosStickyFooterPaddingStyle : undefined,
    iosComposerInset: composerStickyInset,
    iosStickyUsesWindowInset: useIosGlassSticky,
  };
}
