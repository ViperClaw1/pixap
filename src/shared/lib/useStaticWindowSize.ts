import { useMemo } from "react";
import { Dimensions } from "react-native";

/** One-time read on mount — no re-subscribe on rotation. */
export function useStaticWindowSize() {
  return useMemo(() => Dimensions.get("window"), []);
}
