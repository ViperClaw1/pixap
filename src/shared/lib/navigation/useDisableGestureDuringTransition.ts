import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { ParamListBase } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

/**
 * iOS only. Locks the swipe-back gesture while this screen is transitioning
 * (being pushed or revealed by a pop above it), then restores it once the
 * animation settles. Prevents rapid sequential swipes from causing a double pop.
 */
type Options = {
  restoreGestureEnabled?: boolean;
};

export function useDisableGestureDuringTransition(options?: Options): void {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const activeRef = useRef(false);
  const restoreGestureEnabled = options?.restoreGestureEnabled ?? true;

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const lock = () => {
      if (activeRef.current) return;
      activeRef.current = true;
      navigation.setOptions({ gestureEnabled: false });
    };

    const unlock = () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      navigation.setOptions({ gestureEnabled: restoreGestureEnabled });
    };

    const unsubStart = navigation.addListener("transitionStart", lock);
    const unsubEnd = navigation.addListener("transitionEnd", unlock);

    return () => {
      unsubStart();
      unsubEnd();
    };
  }, [navigation, restoreGestureEnabled]);
}
