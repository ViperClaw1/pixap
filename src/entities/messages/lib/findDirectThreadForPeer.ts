import type { MessageThreadItem } from "@/shared/model/types/messages";

/** Returns thread id for an existing direct chat with peer, if present in inbox data. */
export function findDirectThreadForPeer(threads: MessageThreadItem[], peerId: string): string | null {
  for (const thread of threads) {
    if (!thread.participants.some((participant) => participant.id === peerId)) continue;
    if (thread.participants.length > 2) continue;
    return thread.thread_id;
  }
  return null;
}
