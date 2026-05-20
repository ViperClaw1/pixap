import { supabase } from "@/shared/api/supabase/client";
import type { MessageParticipantProfile } from "@/shared/model/types/messages";
import type { MessageBubble } from "../api/useThreadMessages";

export const THREAD_MESSAGES_PAGE_SIZE = 50;

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

type ProfileRow = MessageParticipantProfile & { last_seen_at?: string | null };

export type FetchThreadMessagesPageResult = {
  messages: MessageBubble[];
  participants: MessageParticipantProfile[];
  lastReadAtByUserId: Record<string, string | null>;
  lastSeenAtByUserId: Record<string, string | null>;
  hasMoreOlder: boolean;
  oldestLoadedAt: string | null;
};

function hydrateMessages(
  messages: MessageRow[],
  userId: string,
  reactionsByMessage: Map<string, Array<{ reaction: string; user_id: string }>>,
): MessageBubble[] {
  return messages.map((msg) => {
    const rawReactions = reactionsByMessage.get(msg.id) ?? [];
    const reactionAgg = new Map<string, { count: number; mine: boolean }>();
    for (const reaction of rawReactions) {
      const current = reactionAgg.get(reaction.reaction) ?? { count: 0, mine: false };
      current.count += 1;
      if (reaction.user_id === userId) current.mine = true;
      reactionAgg.set(reaction.reaction, current);
    }
    return {
      id: msg.id,
      thread_id: msg.thread_id,
      sender_id: msg.sender_id,
      content: msg.content,
      attachments: Array.isArray(msg.attachments)
        ? msg.attachments.filter((item): item is string => typeof item === "string")
        : [],
      created_at: msg.created_at,
      mine: msg.sender_id === userId,
      sender_profile: null,
      reactions: Array.from(reactionAgg.entries()).map(([reaction, payload]) => ({
        reaction,
        count: payload.count,
        mine: payload.mine,
      })),
    };
  });
}

export async function fetchThreadMessagesPage({
  threadId,
  userId,
  beforeCreatedAt,
  limit = THREAD_MESSAGES_PAGE_SIZE,
}: {
  threadId: string;
  userId: string;
  beforeCreatedAt?: string | null;
  limit?: number;
}): Promise<FetchThreadMessagesPageResult> {
  let messagesQuery = supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("messages" as any)
    .select("id, thread_id, sender_id, content, attachments, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (beforeCreatedAt) {
    messagesQuery = messagesQuery.lt("created_at", beforeCreatedAt);
  }

  const [{ data: messagesData, error: messagesError }, { data: participantsData, error: participantsError }] =
    await Promise.all([
      messagesQuery,
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("message_thread_participants" as any)
        .select("thread_id, user_id, joined_at, last_read_message_at")
        .eq("thread_id", threadId),
    ]);

  if (messagesError) throw messagesError;
  if (participantsError) throw participantsError;

  const rawRows = (messagesData ?? []) as MessageRow[];
  const hasMoreOlder = rawRows.length > limit;
  const pageRows = hasMoreOlder ? rawRows.slice(0, limit) : rawRows;
  const messagesAsc = [...pageRows].reverse();

  const participants = (participantsData ?? []) as ParticipantRow[];
  const userIds = Array.from(
    new Set([...participants.map((row) => row.user_id), ...messagesAsc.map((row) => row.sender_id)]),
  );

  const { data: profilesData, error: profilesError } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("public_profiles" as any)
    .select("id, first_name, last_name, avatar_url, username, last_seen_at")
    .in("id", userIds);
  if (profilesError) throw profilesError;

  const profileRows = (profilesData ?? []) as ProfileRow[];
  const profilesById = new Map(profileRows.map((row) => [row.id, row]));
  const lastSeenAtByUserId = Object.fromEntries(profileRows.map((row) => [row.id, row.last_seen_at ?? null])) as Record<
    string,
    string | null
  >;
  const lastReadAtByUserId = Object.fromEntries(participants.map((row) => [row.user_id, row.last_read_message_at])) as Record<
    string,
    string | null
  >;

  const messageIds = messagesAsc.map((row) => row.id);
  const reactionsByMessage = new Map<string, Array<{ reaction: string; user_id: string }>>();
  if (messageIds.length) {
    const { data: reactionsData, error: reactionsError } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("message_reactions" as any)
      .select("message_id, user_id, reaction")
      .in("message_id", messageIds);
    if (reactionsError) throw reactionsError;
    for (const row of (reactionsData ?? []) as ReactionRow[]) {
      if (!reactionsByMessage.has(row.message_id)) reactionsByMessage.set(row.message_id, []);
      reactionsByMessage.get(row.message_id)!.push({ reaction: row.reaction, user_id: row.user_id });
    }
  }

  const oldestLoadedAt = messagesAsc[0]?.created_at ?? null;

  return {
    messages: hydrateMessages(messagesAsc, userId, reactionsByMessage),
    participants: participants.map((row) => profilesById.get(row.user_id)).filter(Boolean) as MessageParticipantProfile[],
    lastReadAtByUserId,
    lastSeenAtByUserId,
    hasMoreOlder,
    oldestLoadedAt,
  };
}
