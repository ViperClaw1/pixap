import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  mutateOptimisticPostCommentCreate,
  rollbackOptimisticPostCommentCreate,
  settleOptimisticPostCommentCreate,
} from "@/entities/post/lib/postCommentCachePatch";

interface CreatePostCommentInput {
  postId: string;
  content: string;
  parentCommentId?: string | null;
}

export const useCreatePostComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, content, parentCommentId }: CreatePostCommentInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const text = content.trim();
      if (!text) throw new Error("Comment cannot be empty");

      const { data, error } = await supabase
        .from("post_comments" as any)
        .insert({
          post_id: postId,
          user_id: user.id,
          parent_id: parentCommentId ?? null,
          content: text,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: (variables) => mutateOptimisticPostCommentCreate(queryClient, user?.id, variables),
    onError: (_error, _variables, context) => rollbackOptimisticPostCommentCreate(queryClient, context),
    onSettled: (_data, _error, variables) => settleOptimisticPostCommentCreate(queryClient, variables.postId),
  });
};
