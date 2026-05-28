import { useMemo } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { isProfileAdmin, useProfile } from "@/entities/user";
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
  support_user_id: string | null;
  participants: unknown;
};

function fullName(profile?: Partial<MessageParticipantProfile> | null) {
  return `${profile?.first_name?.trim() ?? ""} ${profile?.last_name?.trim() ?? ""}`.trim() || "Unknown user";
}

function includesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search);
}

function resolveInboxTitle(
  row: InboxSummaryRow,
  participants: MessageParticipantProfile[],
  viewerIsSupportStaff: boolean,
  viewerId: string,
): string {
  if (!row.is_support) {
    const senderProfile = participants.find((profile) => profile.id === row.last_sender_id);
    return fullName(senderProfile);
  }
  if (viewerIsSupportStaff && row.support_user_id && row.support_user_id !== viewerId) {
    const customer = participants.find((profile) => profile.id === row.support_user_id);
    return fullName(customer) || "Support request";
  }
  return "Support";
}

function resolveLastSenderName(
  row: InboxSummaryRow,
  participants: MessageParticipantProfile[],
  viewerIsSupportStaff: boolean,
  viewerId: string,
): string {
  const senderProfile = participants.find((profile) => profile.id === row.last_sender_id);
  if (!row.is_support) return fullName(senderProfile);
  if (viewerIsSupportStaff && row.support_user_id && row.support_user_id !== viewerId) {
    if (row.last_sender_id === row.support_user_id) return fullName(senderProfile);
    return "Support";
  }
  return "Support";
}

export function useMessagesInbox(search: string) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const viewerIsSupportStaff = isProfileAdmin(profile?.account_role);
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

      const supportOwnerIds = Array.from(
        new Set(
          summaries
            .map((row) => row.support_user_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      );
      const supportOwnerRoleById = new Map<string, "user" | "admin">();
      if (supportOwnerIds.length) {
        const { data: ownerProfiles, error: ownerProfilesError } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("public_profiles" as any)
          .select("id, account_role")
          .in("id", supportOwnerIds);
        if (ownerProfilesError) throw ownerProfilesError;
        for (const row of (ownerProfiles ?? []) as Array<{ id: string; account_role?: string | null }>) {
          if (row.account_role === "user" || row.account_role === "admin") {
            supportOwnerRoleById.set(row.id, row.account_role);
          }
        }
      }

      const viewerId = user!.id;
      const items: MessageThreadItem[] = summaries.map((row) => {
        const participants =
          participantsByThread?.get(row.thread_id) ?? parseInboxParticipants(row.participants);
        const lastSenderProfile = participants.find((profile) => profile.id === row.last_sender_id);
        return {
          thread_id: row.thread_id,
          last_message_id: row.last_message_id,
          last_message_text: row.last_message_text,
          last_message_at: row.last_message_at,
          last_sender_id: row.last_sender_id,
          last_sender_name: resolveLastSenderName(row, participants, viewerIsSupportStaff, viewerId),
          last_sender_avatar_url: lastSenderProfile?.avatar_url ?? null,
          unread_count: Number(row.unread_count) || 0,
          participants,
          is_support: row.is_support,
          support_user_id: row.support_user_id,
          support_user_account_role: row.support_user_id
            ? (supportOwnerRoleById.get(row.support_user_id) ?? null)
            : null,
          inbox_title: resolveInboxTitle(row, participants, viewerIsSupportStaff, viewerId),
        };
      });

      return items;
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
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
        includesSearch(thread.inbox_title ?? thread.last_sender_name, normalized) ||
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
