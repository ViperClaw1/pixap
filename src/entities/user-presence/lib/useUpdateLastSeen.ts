import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { LAST_SEEN_HEARTBEAT_MS } from "../model/constants";

async function touchLastSeen(userId: string) {
  const at = new Date().toISOString();
  await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- column added via migration
    .from("profiles" as any)
    .update({ last_seen_at: at })
    .eq("id", userId);
}

/** Keeps profiles.last_seen_at fresh while the user has the app open. */
export function useUpdateLastSeen() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const clearHeartbeat = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const startHeartbeat = () => {
      clearHeartbeat();
      void touchLastSeen(user.id);
      intervalRef.current = setInterval(() => {
        void touchLastSeen(user.id);
      }, LAST_SEEN_HEARTBEAT_MS);
    };

    if (AppState.currentState === "active") {
      startHeartbeat();
    }

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") startHeartbeat();
      else clearHeartbeat();
    });

    return () => {
      sub.remove();
      clearHeartbeat();
    };
  }, [user?.id]);
}
