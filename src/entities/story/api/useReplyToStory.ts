import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { feedCachesContainStory, patchStoryCommentInFeedCaches } from "@/entities/story/lib/storyFeedCachePatch";
import {
  mutateOptimisticStoryTopCommentCreate,
  rollbackOptimisticStoryComment,
  settleOptimisticStoryComment,
} from "@/entities/story/lib/storyCommentCachePatch";

interface ReplyInput {
  storyId: string;
  content: string;
  parentId?: string | null;
}

export const useReplyToStory = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storyId, content, parentId }: ReplyInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const text = content.trim();
      if (!text) throw new Error("Reply cannot be empty");

      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are new and not yet in generated types
        .from("story_comments" as any)
        .insert({
          story_id: storyId,
          user_id: user.id,
          parent_id: parentId ?? null,
          content: text,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: (variables) => {
      if (variables.parentId) return undefined;
      return mutateOptimisticStoryTopCommentCreate(queryClient, user?.id, {
        storyId: variables.storyId,
        content: variables.content,
      });
    },
    onError: (_error, _variables, context) => rollbackOptimisticStoryComment(queryClient, context),
    onSuccess: (data, variables) => {
      if (variables.parentId) return;

      const row = data as { id?: string; content?: string; created_at?: string };
      if (!row?.id || !feedCachesContainStory(queryClient, variables.storyId)) return;

      patchStoryCommentInFeedCaches(queryClient, variables.storyId, {
        commentCountDelta: 0,
        newComment: {
          id: row.id,
          content: String(row.content ?? variables.content),
          created_at: String(row.created_at ?? new Date().toISOString()),
        },
      });
    },
    onSettled: (_data, _error, variables) => settleOptimisticStoryComment(queryClient, variables.storyId),
  });
};
