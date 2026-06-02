import type { Session } from "@supabase/supabase-js";
import { AppState, type AppStateStatus } from "react-native";
import { supabase } from "@/shared/api/supabase/client";
import { devWarn } from "@/shared/lib/devLog";
import { safeRefreshSession } from "@/shared/lib/supabaseAuth";
import { RealtimeConnectionManager } from "./connectionManager";

let authSubscription: { unsubscribe: () => void } | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let foregroundRefreshInProgress = false;

async function applySessionToRealtime(session: Session | null): Promise<void> {
  const manager = RealtimeConnectionManager.get();
  if (!session?.access_token) {
    manager.clearAll();
    return;
  }
  await manager.setAccessToken(session.access_token);
}

/**
 * Wire Supabase auth + app foreground to realtime token refresh and channel reconnect.
 * Call once from RealtimeLifecycleProvider.
 */
export function subscribeRealtimeAuthLifecycle(): () => void {
  authSubscription?.unsubscribe();
  appStateSubscription?.remove();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      RealtimeConnectionManager.get().clearAll();
      return;
    }
    if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      void applySessionToRealtime(session);
      if (event === "TOKEN_REFRESHED") {
        RealtimeConnectionManager.get().reconnectAll("token_refreshed");
      }
    }
  });
  authSubscription = subscription;

  const onAppState = (next: AppStateStatus) => {
    if (next !== "active") return;
    if (foregroundRefreshInProgress) return;
    foregroundRefreshInProgress = true;
    void (async () => {
      try {
        await safeRefreshSession();
        const { data } = await supabase.auth.getSession();
        await applySessionToRealtime(data.session);
        RealtimeConnectionManager.get().reconnectAll("app_foreground");
      } catch (error) {
        devWarn("[realtime] foreground auth refresh failed:", error instanceof Error ? error.message : String(error));
      } finally {
        foregroundRefreshInProgress = false;
      }
    })();
  };

  appStateSubscription = AppState.addEventListener("change", onAppState);

  void supabase.auth.getSession().then(({ data: { session } }) => applySessionToRealtime(session));

  return () => {
    authSubscription?.unsubscribe();
    authSubscription = null;
    appStateSubscription?.remove();
    appStateSubscription = null;
  };
}
