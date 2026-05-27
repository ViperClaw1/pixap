import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  mutateOptimisticStoryReplyCreate,
  rollbackOptimisticStoryComment,
  settleOptimisticStoryComment,
} from "@/entities/story/lib/storyCommentCachePatch";

interface ReplyToCommentInput {
  storyId: string;
  commentId: string;
  content: string;
}

export const useReplyToComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storyId: _storyId, commentId, content }: ReplyToCommentInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const text = content.trim();
      if (!text) throw new Error("Reply cannot be empty");

      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
        .from("story_replies" as any)
        .insert({
          comment_id: commentId,
          user_id: user.id,
          content: text,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: (variables) =>
      mutateOptimisticStoryReplyCreate(queryClient, user?.id, {
        storyId: variables.storyId,
        commentId: variables.commentId,
        content: variables.content,
      }),
    onError: (_error, _variables, context) => rollbackOptimisticStoryComment(queryClient, context),
    onSettled: (_data, _error, variables) => settleOptimisticStoryComment(queryClient, variables.storyId),
  });
};
