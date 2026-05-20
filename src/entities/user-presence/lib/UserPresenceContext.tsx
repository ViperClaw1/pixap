import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { APP_PRESENCE_CHANNEL } from "../model/constants";
import { useUpdateLastSeen } from "./useUpdateLastSeen";

function LastSeenHeartbeat() {
  useUpdateLastSeen();
  return null;
}

type UserPresenceContextValue = {
  onlineUserIds: ReadonlySet<string>;
};

const UserPresenceContext = createContext<UserPresenceContextValue>({
  onlineUserIds: new Set(),
});

function presenceSetsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

function collectPresenceUserIds(state: Record<string, unknown[]>): Set<string> {
  const ids = new Set<string>();
  for (const key of Object.keys(state)) {
    ids.add(key);
    for (const entry of state[key] ?? []) {
      if (entry && typeof entry === "object" && "user_id" in entry) {
        const userId = (entry as { user_id?: string }).user_id;
        if (typeof userId === "string") ids.add(userId);
      }
    }
  }
  return ids;
}

export function UserPresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!user?.id) {
      setOnlineUserIds(new Set());
      return;
    }

    let subscribed = false;
    const channel = supabase.channel(APP_PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    });

    const syncOnlineUsers = () => {
      const next = collectPresenceUserIds(channel.presenceState());
      setOnlineUserIds((prev) => (presenceSetsEqual(prev, next) ? prev : next));
    };

    const setTracked = async (active: boolean) => {
      if (!subscribed) return;
      if (active) {
        await channel.track({ user_id: user.id, at: new Date().toISOString() });
      } else {
        await channel.untrack();
      }
      syncOnlineUsers();
    };

    channel
      .on("presence", { event: "sync" }, syncOnlineUsers)
      .on("presence", { event: "join" }, syncOnlineUsers)
      .on("presence", { event: "leave" }, syncOnlineUsers)
      .subscribe(async (status) => {
        subscribed = status === "SUBSCRIBED";
        if (subscribed) {
          await setTracked(AppState.currentState === "active");
        }
      });

    const appStateSub = AppState.addEventListener("change", (next) => {
      void setTracked(next === "active");
    });

    return () => {
      appStateSub.remove();
      subscribed = false;
      void supabase.removeChannel(channel);
      setOnlineUserIds(new Set());
    };
  }, [user?.id]);

  const value = useMemo(() => ({ onlineUserIds }), [onlineUserIds]);

  return (
    <UserPresenceContext.Provider value={value}>
      <LastSeenHeartbeat />
      {children}
    </UserPresenceContext.Provider>
  );
}

export function useUserPresence() {
  return useContext(UserPresenceContext);
}

export function useIsUserOnline(userId: string | null | undefined): boolean {
  const { onlineUserIds } = useUserPresence();
  if (!userId) return false;
  return onlineUserIds.has(userId);
}
