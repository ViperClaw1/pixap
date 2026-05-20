import { supabase } from "@/shared/api/supabase/client";
import type { MessageParticipantProfile } from "@/shared/model/types/messages";

type InboxSummaryRow = {
  thread_id: string;
  last_sender_id: string;
};

export async function hydrateInboxParticipantsLegacy(
  summaries: InboxSummaryRow[],
): Promise<Map<string, MessageParticipantProfile[]>> {
  const threadIds = summaries.map((row) => row.thread_id);

  const { data: participantsData, error: participantsError } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("message_thread_participants" as any)
    .select("thread_id, user_id")
    .in("thread_id", threadIds);
  if (participantsError) throw participantsError;

  const allParticipants = (participantsData ?? []) as Array<{ thread_id: string; user_id: string }>;
  const profileIds = Array.from(
    new Set([...allParticipants.map((row) => row.user_id), ...summaries.map((row) => row.last_sender_id)]),
  );

  const { data: profilesData, error: profilesError } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("public_profiles" as any)
    .select("id, first_name, last_name, avatar_url, username")
    .in("id", profileIds);
  if (profilesError) throw profilesError;

  const profilesById = new Map<string, MessageParticipantProfile>(
    ((profilesData ?? []) as MessageParticipantProfile[]).map((row) => [row.id, row]),
  );

  const participantsByThread = new Map<string, MessageParticipantProfile[]>();
  for (const row of allParticipants) {
    if (!participantsByThread.has(row.thread_id)) participantsByThread.set(row.thread_id, []);
    const profile = profilesById.get(row.user_id);
    if (!profile) continue;
    participantsByThread.get(row.thread_id)!.push(profile);
  }

  return participantsByThread;
}
