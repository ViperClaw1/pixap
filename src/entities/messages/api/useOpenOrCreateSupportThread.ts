import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

type SupportThreadRpcResult = {
  thread_id: string;
  created: boolean;
};

export function useOpenOrCreateSupportThread() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Authentication required");

      const { data, error } = await supabase.rpc("get_or_create_support_thread");
      if (error) throw error;

      const payload = data as SupportThreadRpcResult | null;
      if (!payload?.thread_id) throw new Error("Could not open support chat");

      return { threadId: payload.thread_id, created: Boolean(payload.created) };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.inboxPrefix });
    },
  });
}
