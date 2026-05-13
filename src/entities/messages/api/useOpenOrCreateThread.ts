import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

type ParticipantRow = { thread_id: string; user_id: string };

function fallbackUuidV4() {
  // UUID v4 fallback for runtimes where crypto.randomUUID is unavailable.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function useOpenOrCreateThread() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (peerUserId: string) => {
      if (!user?.id) throw new Error("Authentication required");
      if (!peerUserId) throw new Error("Peer user is required");
      if (peerUserId === user.id) throw new Error("Cannot create chat with yourself");

      const [{ data: myRows, error: myError }, { data: peerRows, error: peerError }] = await Promise.all([
        supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
          .from("message_thread_participants" as any)
          .select("thread_id, user_id")
          .eq("user_id", user.id),
        supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
          .from("message_thread_participants" as any)
          .select("thread_id, user_id")
          .eq("user_id", peerUserId),
      ]);
      if (myError) throw myError;
      if (peerError) throw peerError;

      const myThreadIds = new Set(((myRows ?? []) as ParticipantRow[]).map((row) => row.thread_id));
      const candidateIds = Array.from(
        new Set(((peerRows ?? []) as ParticipantRow[]).map((row) => row.thread_id).filter((threadId) => myThreadIds.has(threadId))),
      );

      if (candidateIds.length) {
        const { data: candidateRows, error: candidateError } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
          .from("message_thread_participants" as any)
          .select("thread_id, user_id")
          .in("thread_id", candidateIds);
        if (candidateError) throw candidateError;

        const byThread = new Map<string, Set<string>>();
        for (const row of (candidateRows ?? []) as ParticipantRow[]) {
          if (!byThread.has(row.thread_id)) byThread.set(row.thread_id, new Set());
          byThread.get(row.thread_id)!.add(row.user_id);
        }

        const existingDirectThreadId = candidateIds.find((threadId) => {
          const participants = byThread.get(threadId);
          if (!participants) return false;
          return participants.size === 2 && participants.has(user.id) && participants.has(peerUserId);
        });

        if (existingDirectThreadId) return { threadId: existingDirectThreadId, created: false as const };
      }

      const threadId = globalThis.crypto?.randomUUID?.() ?? fallbackUuidV4();
      const { error: createThreadError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
        .from("message_threads" as any)
        .insert({ id: threadId });
      if (createThreadError) throw createThreadError;
      const { error: ownParticipantInsertError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
        .from("message_thread_participants" as any)
        .insert({ thread_id: threadId, user_id: user.id });
      if (ownParticipantInsertError) throw ownParticipantInsertError;

      const { error: peerParticipantInsertError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
        .from("message_thread_participants" as any)
        .insert({ thread_id: threadId, user_id: peerUserId });
      if (peerParticipantInsertError) throw peerParticipantInsertError;

      return { threadId, created: true as const };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.inboxPrefix });
    },
  });
}
