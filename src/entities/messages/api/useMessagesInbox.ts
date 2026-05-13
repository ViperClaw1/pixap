import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import type { MessageThreadItem, MessageParticipantProfile } from "@/types/messages";

type ParticipantRow = {
  thread_id: string;
  user_id: string;
  last_read_message_at: string | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type ProfileRow = MessageParticipantProfile;

function fullName(profile?: Partial<MessageParticipantProfile> | null) {
  return `${profile?.first_name?.trim() ?? ""} ${profile?.last_name?.trim() ?? ""}`.trim() || "Unknown user";
}

function includesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search);
}

export function useMessagesInbox(search: string) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.messages.inbox(user?.id ?? null),
    queryFn: async () => {
      if (!user?.id) return [] as MessageThreadItem[];

      const { data: ownParticipantsData, error: ownParticipantsError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced via migration
        .from("message_thread_participants" as any)
        .select("thread_id, user_id, last_read_message_at")
        .eq("user_id", user.id);
      if (ownParticipantsError) throw ownParticipantsError;

      const ownParticipants = (ownParticipantsData ?? []) as ParticipantRow[];
      if (!ownParticipants.length) return [] as MessageThreadItem[];

      const threadIds = ownParticipants.map((row) => row.thread_id);
      const lastReadByThread = new Map<string, string | null>(ownParticipants.map((row) => [row.thread_id, row.last_read_message_at]));

      const [{ data: messagesData, error: messagesError }, { data: participantsData, error: participantsError }] = await Promise.all([
        supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced via migration
          .from("messages" as any)
          .select("id, thread_id, sender_id, content, created_at")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: false })
          .limit(400),
        supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced via migration
          .from("message_thread_participants" as any)
          .select("thread_id, user_id")
          .in("thread_id", threadIds),
      ]);
      if (messagesError) throw messagesError;
      if (participantsError) throw participantsError;

      const messages = (messagesData ?? []) as MessageRow[];
      const allParticipants = (participantsData ?? []) as Array<{ thread_id: string; user_id: string }>;
      if (!messages.length) return [] as MessageThreadItem[];

      const profileIds = Array.from(new Set([...allParticipants.map((row) => row.user_id), ...messages.map((row) => row.sender_id)]));
      const { data: profilesData, error: profilesError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- view contains fields required by messages feed
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url, username")
        .in("id", profileIds);
      if (profilesError) throw profilesError;

      const profilesById = new Map<string, MessageParticipantProfile>(
        ((profilesData ?? []) as ProfileRow[]).map((row) => [row.id, row]),
      );

      const participantsByThread = new Map<string, MessageParticipantProfile[]>();
      for (const row of allParticipants) {
        if (!participantsByThread.has(row.thread_id)) participantsByThread.set(row.thread_id, []);
        const profile = profilesById.get(row.user_id);
        if (!profile) continue;
        participantsByThread.get(row.thread_id)!.push(profile);
      }

      const latestMessageByThread = new Map<string, MessageRow>();
      const unreadCountByThread = new Map<string, number>();
      for (const message of messages) {
        if (!latestMessageByThread.has(message.thread_id)) {
          latestMessageByThread.set(message.thread_id, message);
        }
        const lastReadAt = lastReadByThread.get(message.thread_id);
        if (message.sender_id !== user.id && (!lastReadAt || new Date(message.created_at).getTime() > new Date(lastReadAt).getTime())) {
          unreadCountByThread.set(message.thread_id, (unreadCountByThread.get(message.thread_id) ?? 0) + 1);
        }
      }

      const items: MessageThreadItem[] = [];
      for (const threadId of threadIds) {
        const latestMessage = latestMessageByThread.get(threadId);
        if (!latestMessage) continue;
        const senderProfile = profilesById.get(latestMessage.sender_id);
        items.push({
          thread_id: threadId,
          last_message_id: latestMessage.id,
          last_message_text: latestMessage.content,
          last_message_at: latestMessage.created_at,
          last_sender_id: latestMessage.sender_id,
          last_sender_name: fullName(senderProfile),
          last_sender_avatar_url: senderProfile?.avatar_url ?? null,
          unread_count: unreadCountByThread.get(threadId) ?? 0,
          participants: participantsByThread.get(threadId) ?? [],
        });
      }

      items.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
      return items;
    },
    enabled: !!user?.id,
    staleTime: 25 * 1000,
  });

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return query.data ?? [];

    return (query.data ?? []).filter((thread) => {
      const participantHit = thread.participants.some((participant) => {
        const display = `${participant.first_name ?? ""} ${participant.last_name ?? ""} ${participant.username ?? ""}`;
        return includesSearch(display, normalized);
      });
      return (
        participantHit ||
        includesSearch(thread.last_sender_name, normalized) ||
        includesSearch(thread.last_message_text, normalized)
      );
    });
  }, [query.data, search]);

  return {
    ...query,
    threads: filtered,
  };
}
