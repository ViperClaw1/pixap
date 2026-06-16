import { initialWindowMetrics } from "react-native-safe-area-context";
import { Platform, StatusBar } from "react-native";

/** Status bar height when `useSafeAreaInsets().top` is temporarily 0. */
export function resolveStatusBarInset(insetsTop: number): number {
  if (insetsTop > 0) return insetsTop;
  const initialTop = initialWindowMetrics?.insets.top ?? 0;
  if (initialTop > 0) return initialTop;
  if (Platform.OS === "android") {
    return StatusBar.currentHeight ?? 24;
  }
  return 47;
}

/** Top offset for hero overlays (progress bar, back/favorite). Matches PlaceDetail. */
export function resolveHeroTopInset(insetsTop: number): number {
  return Math.max(resolveStatusBarInset(insetsTop), 12);
}
