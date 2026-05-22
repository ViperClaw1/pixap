import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/shared/api/supabase/client";
import { devWarn } from "@/shared/lib/devLog";
import { computeBackoffMs } from "./reconnectPolicy";
import { recordRealtimeChannelStatus, recordRealtimeReconnect, type RealtimeChannelScope } from "./realtimePerf";

export type RealtimeChannelStatus = "idle" | "connecting" | "subscribed" | "error" | "closed";

export type CreateRealtimeChannel = () => RealtimeChannel;

type ChannelEntry = {
  channel: RealtimeChannel | null;
  refCount: number;
  status: RealtimeChannelStatus;
  createChannel: CreateRealtimeChannel;
  scope: RealtimeChannelScope;
  listeners: Set<(status: RealtimeChannelStatus) => void>;
  resubscribeAttempt: number;
  resubscribeTimer: ReturnType<typeof setTimeout> | null;
};

/**
 * Singleton ref-counted Supabase Realtime channel registry.
 * One physical WebSocket (supabase client); many logical channels.
 */
export class RealtimeConnectionManager {
  private static instance: RealtimeConnectionManager | null = null;

  private channels = new Map<string, ChannelEntry>();
  private paused = false;
  private reconnectGeneration = 0;
  private reconnectListeners = new Set<() => void>();

  static get(): RealtimeConnectionManager {
    if (!this.instance) this.instance = new RealtimeConnectionManager();
    return this.instance;
  }

  static resetForTests(): void {
    if (this.instance) {
      this.instance.clearAll();
      this.instance = null;
    }
  }

  getReconnectGeneration(): number {
    return this.reconnectGeneration;
  }

  subscribeReconnect(listener: () => void): () => void {
    this.reconnectListeners.add(listener);
    return () => this.reconnectListeners.delete(listener);
  }

  private bumpReconnectGeneration(): void {
    this.reconnectGeneration += 1;
    for (const listener of this.reconnectListeners) {
      listener();
    }
  }

  isPaused(): boolean {
    return this.paused;
  }

  async setAccessToken(accessToken: string | null): Promise<void> {
    try {
      if (accessToken) {
        await supabase.realtime.setAuth(accessToken);
      }
    } catch (error) {
      devWarn("[realtime] setAuth failed:", error instanceof Error ? error.message : error);
    }
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      for (const entry of this.channels.values()) {
        this.teardownChannel(entry);
      }
      return;
    }
    this.reconnectAll("network_online");
  }

  /**
   * Acquire a ref-counted channel. `createChannel` must return a configured channel (with .on handlers).
   */
  acquire(
    key: string,
    createChannel: CreateRealtimeChannel,
    onStatus?: (status: RealtimeChannelStatus) => void,
    scope: RealtimeChannelScope = "other",
  ): () => void {
    let entry = this.channels.get(key);
    if (!entry) {
      entry = {
        channel: null,
        refCount: 0,
        status: "idle",
        createChannel,
        scope,
        listeners: new Set(),
        resubscribeAttempt: 0,
        resubscribeTimer: null,
      };
      this.channels.set(key, entry);
    } else {
      entry.createChannel = createChannel;
    }

    entry.refCount += 1;
    if (onStatus) {
      entry.listeners.add(onStatus);
      onStatus(entry.status);
    }

    if (!this.paused && entry.refCount === 1) {
      this.subscribeEntry(key, entry);
    }

    return () => {
      const current = this.channels.get(key);
      if (!current) return;
      if (onStatus) current.listeners.delete(onStatus);
      current.refCount -= 1;
      if (current.refCount <= 0) {
        this.clearResubscribeTimer(current);
        this.teardownChannel(current);
        this.channels.delete(key);
      }
    };
  }

  reconnectAll(reason: string): void {
    recordRealtimeReconnect(reason);
    this.bumpReconnectGeneration();
    if (this.paused) return;

    for (const [key, entry] of this.channels.entries()) {
      if (entry.refCount <= 0) continue;
      this.clearResubscribeTimer(entry);
      this.teardownChannel(entry);
      this.subscribeEntry(key, entry);
    }
  }

  clearAll(): void {
    for (const entry of this.channels.values()) {
      this.clearResubscribeTimer(entry);
      this.teardownChannel(entry);
    }
    this.channels.clear();
    this.bumpReconnectGeneration();
  }

  private subscribeEntry(key: string, entry: ChannelEntry): void {
    const channel = entry.createChannel();
    entry.channel = channel;
    this.setEntryStatus(entry, "connecting");
    recordRealtimeChannelStatus(entry.scope, "connecting", key);

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        entry.resubscribeAttempt = 0;
        this.setEntryStatus(entry, "subscribed");
        recordRealtimeChannelStatus(entry.scope, "subscribed", key);
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        this.setEntryStatus(entry, "error");
        recordRealtimeChannelStatus(entry.scope, "error", key);
        this.scheduleResubscribe(key, entry);
        return;
      }
      if (status === "CLOSED") {
        this.setEntryStatus(entry, "closed");
        recordRealtimeChannelStatus(entry.scope, "closed", key);
      }
    });
  }

  private scheduleResubscribe(key: string, entry: ChannelEntry): void {
    if (this.paused || entry.refCount <= 0) return;
    this.clearResubscribeTimer(entry);
    const delay = computeBackoffMs(entry.resubscribeAttempt);
    entry.resubscribeAttempt += 1;
    entry.resubscribeTimer = setTimeout(() => {
      entry.resubscribeTimer = null;
      if (entry.refCount <= 0 || this.paused) return;
      this.teardownChannel(entry);
      this.subscribeEntry(key, entry);
    }, delay);
  }

  private teardownChannel(entry: ChannelEntry): void {
    if (entry.channel) {
      void supabase.removeChannel(entry.channel);
      entry.channel = null;
    }
  }

  private clearResubscribeTimer(entry: ChannelEntry): void {
    if (entry.resubscribeTimer) {
      clearTimeout(entry.resubscribeTimer);
      entry.resubscribeTimer = null;
    }
  }

  private setEntryStatus(entry: ChannelEntry, status: RealtimeChannelStatus): void {
    entry.status = status;
    for (const listener of entry.listeners) {
      listener(status);
    }
  }
}

export function isRealtimeChannelSubscribed(status: RealtimeChannelStatus): boolean {
  return status === "subscribed";
}
