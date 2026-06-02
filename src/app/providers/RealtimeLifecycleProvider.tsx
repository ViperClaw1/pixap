import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { subscribeRealtimeAuthLifecycle } from "@/shared/realtime/subscribeRealtimeAuth";
import { useRealtimeNetworkPause } from "@/shared/realtime/useRealtimeNetworkPause";

/** Global realtime auth, reconnect, and offline pause. */
export function RealtimeLifecycleProvider({ children }: { children: ReactNode }) {
  const { authHydrated } = useAuth();
  useEffect(() => {
    if (!authHydrated) return;
    return subscribeRealtimeAuthLifecycle();
  }, [authHydrated]);
  useRealtimeNetworkPause();
  return children;
}
