import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { removePostFromAllFeedCaches } from "@/entities/post/lib/postFeedCachePatch";

interface DeletePostInput {
  postId: string;
}

export const useDeletePost = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId }: DeletePostInput) => {
      if (!user?.id) throw new Error("Authentication required");

      const { data, error } = await supabase
        .from("posts" as any)
        .delete()
        .eq("id", postId)
        .eq("user_id", user.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Could not delete post");
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.posts.feedPrefix });
      const snapshots = queryClient.getQueriesData({ queryKey: queryKeys.posts.feedPrefix });
      removePostFromAllFeedCaches(queryClient, variables.postId);
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.feedPrefix });
      void queryClient.removeQueries({
        queryKey: queryKeys.posts.byId(variables.postId, user?.id ?? null),
      });
    },
  });
};
