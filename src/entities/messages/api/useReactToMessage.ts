import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/shared/api/supabase/client";

export function useReactToMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, messageId, reaction, active }: { threadId: string; messageId: string; reaction: string; active: boolean }) => {
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
    onSuccess: (_res, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["messages", "thread", vars.threadId] });
    },
  });
}
