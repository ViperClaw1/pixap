import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth } from "@/app/providers/AuthProvider";
import { applyPostBoostInFeedCaches } from "@/entities/post/lib/postFeedCachePatch";
import { parseBoostPostRpcResult } from "../lib/parseBoostPostRpcResult";

export function useBoostPost() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!user?.id) throw new Error("Authentication required");
      const { data, error } = await supabase.rpc("boost_post", { p_post_id: postId });
      if (error) throw error;
      return { postId, boostedAt: parseBoostPostRpcResult(data) };
    },
    onSuccess: ({ postId, boostedAt }) => {
      applyPostBoostInFeedCaches(queryClient, postId, boostedAt);
    },
  });
}
