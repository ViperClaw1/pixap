import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/shared/api/supabase/client";
import type { MessageParticipantProfile } from "@/types/messages";

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  attachments: string[] | null;
  created_at: string;
};

type ParticipantRow = {
  thread_id: string;
  user_id: string;
  joined_at: string;
  last_read_message_at: string | null;
};

type ReactionRow = {
  message_id: string;
  user_id: string;
  reaction: string;
};

export type MessageBubble = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  attachments: string[];
  created_at: string;
  mine: boolean;
  sender_profile: MessageParticipantProfile | null;
  reactions: Array<{ reaction: string; count: number; mine: boolean }>;
};

export function useThreadMessages(threadId: string) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["messages", "thread", threadId, user?.id ?? null],
    queryFn: async () => {
      if (!threadId || !user?.id) {
        return {
          messages: [] as MessageBubble[],
          participants: [] as MessageParticipantProfile[],
          lastMessageAtBySender: {} as Record<string, string>,
        };
      }

      const [{ data: messagesData, error: messagesError }, { data: participantsData, error: participantsError }] = await Promise.all([
        supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
          .from("messages" as any)
          .select("id, thread_id, sender_id, content, attachments, created_at")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true }),
        supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
          .from("message_thread_participants" as any)
          .select("thread_id, user_id, joined_at, last_read_message_at")
          .eq("thread_id", threadId),
      ]);
      if (messagesError) throw messagesError;
      if (participantsError) throw participantsError;

      const messages = (messagesData ?? []) as MessageRow[];
      const participants = (participantsData ?? []) as ParticipantRow[];

      const userIds = Array.from(
        new Set([...participants.map((row) => row.user_id), ...messages.map((row) => row.sender_id)]),
      );
      const { data: profilesData, error: profilesError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- view contains user public fields
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url, username")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profilesById = new Map<string, MessageParticipantProfile>(
        ((profilesData ?? []) as MessageParticipantProfile[]).map((row) => [row.id, row]),
      );

      const messageIds = messages.map((row) => row.id);
      const reactionsByMessage = new Map<string, Array<{ reaction: string; user_id: string }>>();
      if (messageIds.length) {
        const { data: reactionsData, error: reactionsError } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
          .from("message_reactions" as any)
          .select("message_id, user_id, reaction")
          .in("message_id", messageIds);
        if (reactionsError) throw reactionsError;
        for (const row of (reactionsData ?? []) as ReactionRow[]) {
          if (!reactionsByMessage.has(row.message_id)) reactionsByMessage.set(row.message_id, []);
          reactionsByMessage.get(row.message_id)!.push({ reaction: row.reaction, user_id: row.user_id });
        }
      }

      const lastMessageAtBySender: Record<string, string> = {};
      for (const msg of messages) {
        lastMessageAtBySender[msg.sender_id] = msg.created_at;
      }

      const hydratedMessages: MessageBubble[] = messages.map((msg) => {
        const rawReactions = reactionsByMessage.get(msg.id) ?? [];
        const reactionAgg = new Map<string, { count: number; mine: boolean }>();
        for (const reaction of rawReactions) {
          const current = reactionAgg.get(reaction.reaction) ?? { count: 0, mine: false };
          current.count += 1;
          if (reaction.user_id === user.id) current.mine = true;
          reactionAgg.set(reaction.reaction, current);
        }
        return {
          id: msg.id,
          thread_id: msg.thread_id,
          sender_id: msg.sender_id,
          content: msg.content,
          attachments: Array.isArray(msg.attachments) ? msg.attachments.filter((item): item is string => typeof item === "string") : [],
          created_at: msg.created_at,
          mine: msg.sender_id === user.id,
          sender_profile: profilesById.get(msg.sender_id) ?? null,
          reactions: Array.from(reactionAgg.entries()).map(([reaction, payload]) => ({
            reaction,
            count: payload.count,
            mine: payload.mine,
          })),
        };
      });

      return {
        messages: hydratedMessages,
        participants: participants.map((row) => profilesById.get(row.user_id)).filter(Boolean) as MessageParticipantProfile[],
        lastMessageAtBySender,
      };
    },
    enabled: !!threadId && !!user?.id,
  });

  const peer = useMemo(() => {
    if (!user?.id) return null;
    return (query.data?.participants ?? []).find((participant) => participant.id !== user.id) ?? null;
  }, [query.data?.participants, user?.id]);

  const peerLastSeenAt = useMemo(() => {
    if (!peer?.id) return null;
    return query.data?.lastMessageAtBySender?.[peer.id] ?? null;
  }, [peer?.id, query.data?.lastMessageAtBySender]);

  return {
    ...query,
    messages: query.data?.messages ?? [],
    participants: query.data?.participants ?? [],
    peer,
    peerLastSeenAt,
  };
}
