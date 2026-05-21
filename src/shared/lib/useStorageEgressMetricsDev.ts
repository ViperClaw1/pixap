import { useEffect } from "react";
import { AppState } from "react-native";
import { logStorageEgressMetricsSummary } from "@/shared/lib/storageEgressMetrics";

/** Dev-only: dump storage egress counters when app goes to background. */
export function useStorageEgressMetricsDev() {
  useEffect(() => {
    if (!__DEV__) return;

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        logStorageEgressMetricsSummary();
      }
    });

    return () => sub.remove();
  }, []);
}
