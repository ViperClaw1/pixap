import { useCallback, useRef } from "react";
import { useNavigation } from "@react-navigation/native";

const DEFAULT_RESET_MS = 500;

/** Prevents double navigation from rapid taps (notably on iOS). */
export function useNavigationGuard(resetMs = DEFAULT_RESET_MS) {
  const navigation = useNavigation();
  const tappingRef = useRef(false);

  const guardAction = useCallback(
    (action: () => void) => {
      if (!navigation.isFocused() || tappingRef.current) return;
      tappingRef.current = true;
      action();
      setTimeout(() => {
        tappingRef.current = false;
      }, resetMs);
    },
    [navigation, resetMs],
  );

  const guardedNavigate = useCallback(
    (...args: Parameters<typeof navigation.navigate>) => {
      guardAction(() => {
        navigation.navigate(...args);
      });
    },
    [guardAction, navigation],
  );

  return { guardAction, guardedNavigate };
}
