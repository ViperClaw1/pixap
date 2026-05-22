import { useEffect } from "react";
import { AppState } from "react-native";
import { devInfo } from "@/shared/lib/devLog";
import { getRealtimePerfSnapshot } from "@/shared/realtime/realtimePerf";

/** Dev-only: log realtime reconnect/error counters on foreground. */
export function useRealtimeMetricsDev(): void {
  useEffect(() => {
    if (!__DEV__) return;

    const log = () => {
      const snap = getRealtimePerfSnapshot();
      devInfo(`[realtime-perf] snapshot reconnects=${snap.sessionReconnectCount} errors=${snap.channelErrorCount}`);
    };

    log();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") log();
    });
    return () => sub.remove();
  }, []);
}
