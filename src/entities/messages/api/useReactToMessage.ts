import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import {
  getThreadMessagesCache,
  patchThreadMessageReaction,
  setThreadMessagesCache,
  type ThreadMessagesCache,
} from "@/entities/messages/lib/messageCachePatch";

export function useReactToMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      messageId,
      reaction,
      active,
    }: {
      threadId: string;
      messageId: string;
      reaction: string;
      active: boolean;
    }) => {
      if (!user?.id) throw new Error("Authentication required");
      if (!messageId) throw new Error("Message is required");

      if (active) {
        const { error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
          .from("message_reactions" as any)
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", user.id)
          .eq("reaction", reaction);
        if (error) throw error;
      } else {
        const { error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
          .from("message_reactions" as any)
          .insert({
            message_id: messageId,
            user_id: user.id,
            reaction,
          });
        if (error) throw error;
      }

      return { threadId };
    },
    onMutate: async (vars) => {
      if (!user?.id) return;
      await queryClient.cancelQueries({ queryKey: queryKeys.messages.threadPrefix(vars.threadId) });
      const prev = getThreadMessagesCache(queryClient, vars.threadId, user.id);
      patchThreadMessageReaction(
        queryClient,
        vars.threadId,
        user.id,
        vars.messageId,
        vars.reaction,
        vars.active,
      );
      return { prev };
    },
    onError: (_err, vars, context) => {
      if (!user?.id || !context?.prev) return;
      setThreadMessagesCache(queryClient, vars.threadId, user.id, () => context.prev as ThreadMessagesCache);
    },
    onSuccess: (_res, vars) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messages.threadPrefix(vars.threadId),
        refetchType: "none",
      });
    },
  });
}
