import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/shared/api/supabase/client";

type DeleteMode = "me" | "everyone";

export function useDeleteMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, messageId, mode }: { threadId: string; messageId: string; mode: DeleteMode }) => {
      if (!user?.id) throw new Error("Authentication required");
      if (!threadId || !messageId) throw new Error("Thread and message are required");

      if (mode === "me") {
        const { error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
          .from("message_hidden_for_users" as any)
          .upsert({ message_id: messageId, user_id: user.id }, { onConflict: "message_id,user_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- delete is guarded by RLS sender policy
          .from("messages" as any)
          .delete()
          .eq("id", messageId);
        if (error) throw error;
      }

      return { threadId };
    },
    onSuccess: (_res, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["messages", "thread", vars.threadId] });
      void queryClient.invalidateQueries({ queryKey: ["messages", "inbox"] });
    },
  });
}
