import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/shared/api/supabase/client";
import type { MessageThreadItem } from "@/shared/model/types/messages";
import {
  MESSAGE_THREAD_TYPING_EVENT,
  PEER_TYPING_IDLE_MS,
  type MessageThreadTypingPayload,
} from "./messageThreadTyping";

type InboxTypingTarget = {
  threadId: string;
  peerId: string;
};

function buildInboxTypingTargets(
  threads: MessageThreadItem[],
  userId: string | null | undefined,
): InboxTypingTarget[] {
  if (!userId) return [];
  return threads
    .filter((thread) => !thread.is_support)
    .map((thread) => {
      const peer = thread.participants.find((participant) => participant.id !== userId);
      if (!peer?.id) return null;
      return { threadId: thread.thread_id, peerId: peer.id };
    })
    .filter((target): target is InboxTypingTarget => target != null);
}

function targetsKey(targets: InboxTypingTarget[]): string {
  return targets.map((t) => `${t.threadId}:${t.peerId}`).join("|");
}

/** Cap realtime typing channels — N subscriptions on inbox open blocked the Android JS thread. */
const MAX_INBOX_TYPING_CHANNELS = 12;

function limitTypingTargets(threads: MessageThreadItem[], userId: string | null | undefined): InboxTypingTarget[] {
  const targets = buildInboxTypingTargets(threads, userId);
  if (targets.length <= MAX_INBOX_TYPING_CHANNELS) return targets;
  const recentThreadIds = new Set(
    [...threads]
      .filter((t) => !t.is_support)
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
      .slice(0, MAX_INBOX_TYPING_CHANNELS)
      .map((t) => t.thread_id),
  );
  return targets.filter((t) => recentThreadIds.has(t.threadId));
}

/** Subscribes to per-thread typing broadcasts for inbox rows (Messages list). */
export function useMessagesInboxTyping(
  threads: MessageThreadItem[],
  userId: string | null | undefined,
  enabled = true,
): ReadonlySet<string> {
  const targets = useMemo(() => limitTypingTargets(threads, userId), [threads, userId]);
  const targetsKeyValue = useMemo(() => targetsKey(targets), [targets]);
  const [typingThreadIds, setTypingThreadIds] = useState<ReadonlySet<string>>(() => new Set());
  const idleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!enabled || !userId || targets.length === 0) {
      setTypingThreadIds(new Set());
      return undefined;
    }

    const channels: RealtimeChannel[] = [];

    const clearIdleTimer = (threadId: string) => {
      const timer = idleTimersRef.current.get(threadId);
      if (!timer) return;
      clearTimeout(timer);
      idleTimersRef.current.delete(threadId);
    };

    const setThreadTyping = (threadId: string, isTyping: boolean) => {
      setTypingThreadIds((prev) => {
        const has = prev.has(threadId);
        if (isTyping === has) return prev;
        const next = new Set(prev);
        if (isTyping) next.add(threadId);
        else next.delete(threadId);
        return next;
      });
    };

    const scheduleIdle = (threadId: string) => {
      clearIdleTimer(threadId);
      idleTimersRef.current.set(
        threadId,
        setTimeout(() => {
          idleTimersRef.current.delete(threadId);
          setThreadTyping(threadId, false);
        }, PEER_TYPING_IDLE_MS),
      );
    };

    for (const { threadId, peerId } of targets) {
      const channel = supabase
        .channel(`messages_thread_typing_${threadId}`, {
          config: { broadcast: { self: false } },
        })
        .on("broadcast", { event: MESSAGE_THREAD_TYPING_EVENT }, ({ payload }) => {
          const event = payload as Partial<MessageThreadTypingPayload>;
          if (event.user_id !== peerId) return;

          if (!event.is_typing) {
            clearIdleTimer(threadId);
            setThreadTyping(threadId, false);
            return;
          }

          setThreadTyping(threadId, true);
          scheduleIdle(threadId);
        })
        .subscribe();

      channels.push(channel);
    }

    return () => {
      for (const timer of idleTimersRef.current.values()) {
        clearTimeout(timer);
      }
      idleTimersRef.current.clear();
      setTypingThreadIds(new Set());
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, targets, targetsKeyValue, userId]);

  return typingThreadIds;
}
