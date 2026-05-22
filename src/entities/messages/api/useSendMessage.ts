import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { uploadMessageAttachmentIfLocal } from "@/entities/messages/lib/uploadMessageAttachmentToStories";
import {
  appendThreadMessage,
  removeThreadMessage,
  replaceOptimisticThreadMessage,
} from "@/entities/messages/lib/messageCachePatch";
import { rowToMessageBubble } from "@/entities/messages/lib/hydrateRealtimeMessage";
import type { MessageBubble } from "./useThreadMessages";

export type SendMessageAttachmentInput =
  | string
  | { uri: string; mimeType?: string | null; name?: string | null };

type InsertedMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  attachments: string[] | null;
  created_at: string;
};

function normalizeAttachment(att: SendMessageAttachmentInput): { uri: string; mimeType?: string | null; name?: string | null } {
  return typeof att === "string" ? { uri: att } : att;
}

function createOptimisticMessage(params: {
  id: string;
  threadId: string;
  userId: string;
  content: string;
  attachments: string[];
}): MessageBubble {
  return {
    id: params.id,
    thread_id: params.threadId,
    sender_id: params.userId,
    content: params.content,
    attachments: params.attachments,
    created_at: new Date().toISOString(),
    mine: true,
    sender_profile: null,
    reactions: [],
  };
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
    }): Promise<InsertedMessageRow> => {
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

      const { data: inserted, error: insertError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
        .from("messages" as any)
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          content: trimmed || "[attachment]",
          attachments: normalizedAttachments,
        })
        .select("id, thread_id, sender_id, content, attachments, created_at")
        .single();
      if (insertError) throw insertError;
      if (!inserted) throw new Error("Message insert returned no row");

      const at = new Date().toISOString();
      const { error: markReadError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by migration
        .from("message_thread_participants" as any)
        .update({ last_read_message_at: at })
        .eq("thread_id", threadId)
        .eq("user_id", user.id);
      if (markReadError) throw markReadError;

      return inserted as InsertedMessageRow;
    },
    onMutate: async (vars) => {
      if (!user?.id) return;
      const optimisticId = `optimistic-${Date.now()}`;
      const trimmed = vars.content.trim();
      appendThreadMessage(
        queryClient,
        vars.threadId,
        user.id,
        createOptimisticMessage({
          id: optimisticId,
          threadId: vars.threadId,
          userId: user.id,
          content: trimmed || "[attachment]",
          attachments: (vars.attachments ?? [])
            .map(normalizeAttachment)
            .map((a) => a.uri)
            .filter((uri) => uri.trim().length > 0),
        }),
      );
      return { optimisticId };
    },
    onSuccess: (inserted, vars, context) => {
      if (!user?.id) return;
      if (context?.optimisticId) {
        replaceOptimisticThreadMessage(
          queryClient,
          vars.threadId,
          user.id,
          context.optimisticId,
          rowToMessageBubble(inserted, user.id),
        );
      } else {
        appendThreadMessage(queryClient, vars.threadId, user.id, rowToMessageBubble(inserted, user.id));
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.inboxPrefix });
    },
    onError: (_err, vars, context) => {
      if (context?.optimisticId) {
        removeThreadMessage(queryClient, vars.threadId, user?.id ?? null, context.optimisticId);
      }
    },
  });
}
