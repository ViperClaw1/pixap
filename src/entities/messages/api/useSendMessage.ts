import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/shared/api/supabase/client";

export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, content, attachments }: { threadId: string; content: string; attachments?: string[] }) => {
      if (!user?.id) throw new Error("Authentication required");
      const trimmed = content.trim();
      const normalizedAttachments = (attachments ?? []).filter((item): item is string => typeof item === "string" && item.length > 0);
      if (!threadId || (!trimmed && !normalizedAttachments.length)) throw new Error("Message content or attachment is required");

      const { error: insertError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
        .from("messages" as any)
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          content: trimmed || "[attachment]",
          attachments: normalizedAttachments,
        });
      if (insertError) throw insertError;

      const { error: markReadError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
        .from("message_thread_participants" as any)
        .update({ last_read_message_at: new Date().toISOString() })
        .eq("thread_id", threadId)
        .eq("user_id", user.id);
      if (markReadError) throw markReadError;
    },
    onSuccess: (_res, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["messages", "thread", vars.threadId] });
      void queryClient.invalidateQueries({ queryKey: ["messages", "inbox"] });
    },
  });
}
