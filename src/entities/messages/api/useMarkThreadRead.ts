import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/shared/api/supabase/client";

export function useMarkThreadRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (threadId: string) => {
      if (!user?.id) throw new Error("Authentication required");
      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced via migration
        .from("message_thread_participants" as any)
        .update({ last_read_message_at: new Date().toISOString() })
        .eq("thread_id", threadId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", "inbox"] });
    },
  });
}
