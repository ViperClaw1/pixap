import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { patchPostInAllFeedCaches } from "@/entities/post/lib/postFeedCachePatch";

interface UpdatePostInput {
  postId: string;
  content: string;
}

export const useUpdatePost = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, content }: UpdatePostInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const text = content.trim();
      if (!text) throw new Error("Post text cannot be empty");

      const { error } = await supabase
        .from("posts" as any)
        .update({ content: text })
        .eq("id", postId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.posts.feedPrefix });
      const trimmed = variables.content.trim();
      const snapshots = queryClient.getQueriesData({ queryKey: queryKeys.posts.feedPrefix });
      patchPostInAllFeedCaches(queryClient, variables.postId, (post) => ({ ...post, content: trimmed }));
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.feedPrefix });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.posts.byId(variables.postId, user?.id ?? null),
      });
    },
  });
};
