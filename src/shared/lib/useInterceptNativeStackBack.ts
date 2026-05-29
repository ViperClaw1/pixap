import { useEffect, useRef, type MutableRefObject } from "react";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";

type InterceptOptions = {
  /** When true, programmatic pops (e.g. StackActions.pop) are not intercepted. */
  isProgrammaticPopRef: MutableRefObject<boolean>;
};

/**
 * Replaces default stack pop (iOS edge swipe / header back) with a custom handler.
 * Used when goBack() must cross tabs instead of a plain stack pop.
 */
export function useInterceptNativeStackBack(
  navigation: NavigationProp<ParamListBase>,
  enabled: boolean,
  onBack: () => void,
  options: InterceptOptions,
) {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (options.isProgrammaticPopRef.current) return;

      const actionType = event.data.action.type;
      if (actionType !== "GO_BACK" && actionType !== "POP") return;

      event.preventDefault();
      onBackRef.current();
    });
    return unsubscribe;
  }, [navigation, enabled, options.isProgrammaticPopRef]);
}
