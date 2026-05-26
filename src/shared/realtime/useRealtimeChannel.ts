import { useEffect, useReducer, useState } from "react";
import {
  RealtimeConnectionManager,
  type CreateRealtimeChannel,
  type RealtimeChannelStatus,
  isRealtimeChannelSubscribed,
} from "./connectionManager";
import type { RealtimeChannelScope } from "./realtimePerf";

/**
 * Ref-counted Supabase channel subscription tied to component lifecycle.
 * Returns whether the channel is SUBSCRIBED (for polling fallback gating).
 */
export function useRealtimeChannel(
  key: string | null | undefined,
  createChannel: CreateRealtimeChannel | null,
  options?: { scope?: RealtimeChannelScope; enabled?: boolean },
): boolean {
  /** Start disconnected so polling fallback stays active until SUBSCRIBED is confirmed. */
  const [status, setStatus] = useState<RealtimeChannelStatus>("connecting");
  const enabled = options?.enabled !== false;
  const scope = options?.scope ?? "other";
  const [, bumpReconnect] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const manager = RealtimeConnectionManager.get();
    return manager.subscribeReconnect(bumpReconnect);
  }, []);

  useEffect(() => {
    if (!key || !createChannel || !enabled) {
      setStatus("closed");
      return;
    }

    const manager = RealtimeConnectionManager.get();
    if (manager.isPaused()) {
      setStatus("closed");
      return;
    }

    const release = manager.acquire(key, createChannel, setStatus, scope);
    return release;
  }, [key, createChannel, enabled, scope, bumpReconnect]);

  return isRealtimeChannelSubscribed(status);
}
