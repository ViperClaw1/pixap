import type { RealtimeEvent } from "./events";

type RealtimeListener = (event: RealtimeEvent) => void;

/** Lightweight in-process bus for demuxed realtime events (optional handlers). */
class RealtimeEventBus {
  private listeners = new Set<RealtimeListener>();

  subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: RealtimeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export const realtimeEventBus = new RealtimeEventBus();
