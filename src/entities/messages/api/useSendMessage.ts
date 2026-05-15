import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { uploadMessageAttachmentIfLocal } from "@/entities/messages/lib/uploadMessageAttachmentToStories";

export type SendMessageAttachmentInput =
  | string
  | { uri: string; mimeType?: string | null; name?: string | null };

function normalizeAttachment(att: SendMessageAttachmentInput): { uri: string; mimeType?: string | null; name?: string | null } {
  return typeof att === "string" ? { uri: att } : att;
}

export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      content,
      attachments,
    }: {
      threadId: string;
      content: string;
      attachments?: SendMessageAttachmentInput[];
    }) => {
      if (!user?.id) throw new Error("Authentication required");
      const trimmed = content.trim();
      const rawAttachments = (attachments ?? []).map(normalizeAttachment).filter((a) => a.uri.trim().length > 0);
      const normalizedAttachments: string[] = [];
      for (const att of rawAttachments) {
        const url = await uploadMessageAttachmentIfLocal(user.id, att.uri, {
          mimeType: att.mimeType,
          name: att.name,
        });
        normalizedAttachments.push(url);
      }
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.threadPrefix(vars.threadId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.inboxPrefix });
    },
  });
}
