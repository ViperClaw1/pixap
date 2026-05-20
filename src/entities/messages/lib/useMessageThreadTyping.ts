import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/shared/api/supabase/client";
import {
  MESSAGE_THREAD_TYPING_EVENT,
  PEER_TYPING_IDLE_MS,
  TYPING_BROADCAST_THROTTLE_MS,
  type MessageThreadTypingPayload,
} from "./messageThreadTyping";

type UseMessageThreadTypingParams = {
  threadId: string;
  userId: string | null | undefined;
  peerId: string | null | undefined;
  draft: string;
  enabled?: boolean;
};

export function useMessageThreadTyping({
  threadId,
  userId,
  peerId,
  draft,
  enabled = true,
}: UseMessageThreadTypingParams) {
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  const subscribedRef = useRef(false);
  const wasTypingRef = useRef(false);
  const lastBroadcastAtRef = useRef(0);
  const peerIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const clearPeerIdleTimer = useCallback(() => {
    if (peerIdleTimerRef.current) {
      clearTimeout(peerIdleTimerRef.current);
      peerIdleTimerRef.current = null;
    }
  }, []);

  const schedulePeerIdle = useCallback(() => {
    clearPeerIdleTimer();
    peerIdleTimerRef.current = setTimeout(() => {
      setPeerIsTyping(false);
    }, PEER_TYPING_IDLE_MS);
  }, [clearPeerIdleTimer]);

  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      if (!subscribedRef.current || !userId) return;
      const channel = channelRef.current;
      if (!channel) return;
      void channel.send({
        type: "broadcast",
        event: MESSAGE_THREAD_TYPING_EVENT,
        payload: { user_id: userId, is_typing: isTyping } satisfies MessageThreadTypingPayload,
      });
    },
    [userId],
  );

  const stopTyping = useCallback(() => {
    if (!wasTypingRef.current) return;
    wasTypingRef.current = false;
    broadcastTyping(false);
  }, [broadcastTyping]);

  useEffect(() => {
    if (!enabled || !threadId || !userId || !peerId) {
      setPeerIsTyping(false);
      return;
    }

    const channel = supabase
      .channel(`messages_thread_typing_${threadId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: MESSAGE_THREAD_TYPING_EVENT }, ({ payload }) => {
        const event = payload as Partial<MessageThreadTypingPayload>;
        if (event.user_id !== peerId) return;

        if (!event.is_typing) {
          clearPeerIdleTimer();
          setPeerIsTyping(false);
          return;
        }

        setPeerIsTyping(true);
        schedulePeerIdle();
      })
      .subscribe((status) => {
        subscribedRef.current = status === "SUBSCRIBED";
      });

    channelRef.current = channel;

    return () => {
      stopTyping();
      subscribedRef.current = false;
      clearPeerIdleTimer();
      setPeerIsTyping(false);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [threadId, userId, peerId, enabled, clearPeerIdleTimer, schedulePeerIdle, stopTyping]);

  useEffect(() => {
    if (!enabled || !userId || !peerId) return;

    const isDrafting = draft.trim().length > 0;
    if (!isDrafting) {
      stopTyping();
      return;
    }

    const now = Date.now();
    const shouldBroadcast = !wasTypingRef.current || now - lastBroadcastAtRef.current >= TYPING_BROADCAST_THROTTLE_MS;
    if (!shouldBroadcast) return;

    wasTypingRef.current = true;
    lastBroadcastAtRef.current = now;
    broadcastTyping(true);
  }, [draft, enabled, userId, peerId, broadcastTyping, stopTyping]);

  return { peerIsTyping, stopTyping };
}
