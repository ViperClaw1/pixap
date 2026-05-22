import { useMemo } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import type { MessageThreadItem, MessageParticipantProfile } from "@/shared/model/types/messages";
import { hydrateInboxParticipantsLegacy } from "@/entities/messages/lib/hydrateInboxParticipantsLegacy";
import { parseInboxParticipants } from "@/entities/messages/lib/parseInboxParticipants";
import { useMessagesInboxRealtime } from "@/entities/messages/lib/useMessagesRealtime";
import { REALTIME_POLL_MS } from "@/shared/realtime/realtimePolling";

type InboxSummaryRow = {
  thread_id: string;
  last_message_id: string;
  last_message_text: string;
  last_message_at: string;
  last_sender_id: string;
  unread_count: number;
  is_support: boolean;
  participants: unknown;
};

function fullName(profile?: Partial<MessageParticipantProfile> | null) {
  return `${profile?.first_name?.trim() ?? ""} ${profile?.last_name?.trim() ?? ""}`.trim() || "Unknown user";
}

function includesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search);
}

export function useMessagesInbox(search: string) {
  const { user } = useAuth();
  const isScreenFocused = useIsFocused();
  const realtimeConnected = useMessagesInboxRealtime(isScreenFocused ? (user?.id ?? null) : null);

  const query = useQuery({
    queryKey: queryKeys.messages.inbox(user?.id ?? null),
    queryFn: async () => {
      if (!user?.id) return [] as MessageThreadItem[];

      const { data: summaryData, error: summaryError } = await (
        supabase.rpc as (fn: string) => ReturnType<typeof supabase.rpc>
      )("get_message_inbox_summary");
      if (summaryError) throw summaryError;

      const summaries = (summaryData ?? []) as InboxSummaryRow[];
      if (!summaries.length) return [] as MessageThreadItem[];

      const participantsByThread =
        summaries[0]?.participants != null
          ? null
          : await hydrateInboxParticipantsLegacy(summaries);

      const items: MessageThreadItem[] = summaries.map((row) => {
        const participants =
          participantsByThread?.get(row.thread_id) ?? parseInboxParticipants(row.participants);
        const senderProfile = participants.find((profile) => profile.id === row.last_sender_id);
        return {
          thread_id: row.thread_id,
          last_message_id: row.last_message_id,
          last_message_text: row.last_message_text,
          last_message_at: row.last_message_at,
          last_sender_id: row.last_sender_id,
          last_sender_name: row.is_support ? "Support" : fullName(senderProfile),
          last_sender_avatar_url: row.is_support ? null : (senderProfile?.avatar_url ?? null),
          unread_count: Number(row.unread_count) || 0,
          participants,
          is_support: row.is_support,
        };
      });

      return items;
    },
    enabled: !!user?.id,
    staleTime: 40 * 1000,
    refetchInterval: realtimeConnected ? false : REALTIME_POLL_MS.messagesInbox,
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
        thread.is_support ||
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
