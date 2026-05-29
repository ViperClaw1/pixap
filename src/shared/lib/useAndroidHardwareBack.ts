import { useCallback } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

/** Handles Android system back — returns true to consume the event. */
export function useAndroidHardwareBack(onBack: () => void, enabled = true) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        onBack();
        return true;
      });
      return () => subscription.remove();
    }, [enabled, onBack]),
  );
}
