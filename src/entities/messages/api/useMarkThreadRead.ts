import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { patchInboxThreadUnread, patchThreadLastRead } from "@/entities/messages/lib/messageCachePatch";

export function useMarkThreadRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (threadId: string) => {
      if (!user?.id) throw new Error("Authentication required");
      const at = new Date().toISOString();
      patchThreadLastRead(queryClient, threadId, user.id, user.id, at);
      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced via migration
        .from("message_thread_participants" as any)
        .update({ last_read_message_at: at })
        .eq("thread_id", threadId)
        .eq("user_id", user.id);
      if (error) throw error;
      return at;
    },
    onSuccess: (_at, threadId) => {
      if (!user?.id) return;
      patchInboxThreadUnread(queryClient, user.id, threadId, 0);
    },
    onError: (_err, threadId: string) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.threadPrefix(threadId) });
    },
  });
}
