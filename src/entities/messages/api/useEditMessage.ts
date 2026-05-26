import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import {
  getThreadMessagesCache,
  patchThreadMessageContent,
  setThreadMessagesCache,
  type ThreadMessagesCache,
} from "@/entities/messages/lib/messageCachePatch";

type UpdatedMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  attachments: string[] | null;
  attachment_blurhashes?: unknown;
  created_at: string;
};

export function useEditMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      messageId,
      content,
    }: {
      threadId: string;
      messageId: string;
      content: string;
    }): Promise<UpdatedMessageRow> => {
      if (!user?.id) throw new Error("Authentication required");
      const trimmed = content.trim();
      if (!threadId || !messageId) throw new Error("Thread and message are required");
      if (!trimmed) throw new Error("Message cannot be empty");

      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
        .from("messages" as any)
        .update({ content: trimmed })
        .eq("id", messageId)
        .eq("sender_id", user.id)
        .select("id, thread_id, sender_id, content, attachments, attachment_blurhashes, created_at")
        .single();

      if (error) throw error;
      if (!data) throw new Error("Message update returned no row");
      return data as UpdatedMessageRow;
    },
    onMutate: async (vars) => {
      if (!user?.id) return;
      await queryClient.cancelQueries({ queryKey: queryKeys.messages.threadPrefix(vars.threadId) });
      const prev = getThreadMessagesCache(queryClient, vars.threadId, user.id);
      patchThreadMessageContent(queryClient, vars.threadId, user.id, vars.messageId, vars.content.trim());
      return { prev };
    },
    onError: (_err, vars, context) => {
      if (!user?.id || !context?.prev) return;
      setThreadMessagesCache(queryClient, vars.threadId, user.id, () => context.prev as ThreadMessagesCache);
    },
    onSuccess: (_res, vars) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.inboxPrefix });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messages.threadPrefix(vars.threadId),
        refetchType: "none",
      });
    },
  });
}
