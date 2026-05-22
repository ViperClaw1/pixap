import { useEffect, type ReactNode } from "react";
import { subscribeRealtimeAuthLifecycle } from "@/shared/realtime/subscribeRealtimeAuth";
import { useRealtimeNetworkPause } from "@/shared/realtime/useRealtimeNetworkPause";

/** Global realtime auth, reconnect, and offline pause. */
export function RealtimeLifecycleProvider({ children }: { children: ReactNode }) {
  useEffect(() => subscribeRealtimeAuthLifecycle(), []);
  useRealtimeNetworkPause();
  return children;
}
