import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  mutateOptimisticPostCommentCreate,
  rollbackOptimisticPostCommentCreate,
  settleOptimisticPostCommentCreate,
} from "@/entities/post/lib/postCommentCachePatch";

interface ReplyToPostCommentInput {
  postId: string;
  parentCommentId: string;
  content: string;
}

export const useReplyToPostComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, parentCommentId, content }: ReplyToPostCommentInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const text = content.trim();
      if (!text) throw new Error("Reply cannot be empty");

      const { data, error } = await supabase
        .from("post_comments" as any)
        .insert({
          post_id: postId,
          user_id: user.id,
          parent_id: parentCommentId,
          content: text,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: (variables) =>
      mutateOptimisticPostCommentCreate(queryClient, user?.id, {
        postId: variables.postId,
        content: variables.content,
        parentCommentId: variables.parentCommentId,
      }),
    onError: (_error, _variables, context) => rollbackOptimisticPostCommentCreate(queryClient, context),
    onSettled: (_data, _error, variables) => settleOptimisticPostCommentCreate(queryClient, variables.postId),
  });
};
