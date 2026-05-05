import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ReactToPostInput {
  postId: string;
  type: "like";
}

export const useReactToPost = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, type }: ReactToPostInput) => {
      if (!user?.id) throw new Error("Authentication required");

      const { data: existing, error: fetchError } = await supabase
        .from("post_reactions" as any)
        .select("id, type")
        .eq("user_id", user.id)
        .eq("post_id", postId)
        .maybeSingle();
      if (fetchError) throw fetchError;

      const existingReaction = existing as { id: string; type: "like" | "dislike" | "sticker" } | null;
      if (existingReaction?.type === type) {
        const { error } = await supabase.from("post_reactions" as any).delete().eq("id", existingReaction.id);
        if (error) throw error;
        return { action: "removed" as const };
      }

      if (existingReaction?.id) {
        const { data, error } = await supabase
          .from("post_reactions" as any)
          .update({
            type,
            sticker_id: null,
            created_at: new Date().toISOString(),
          })
          .eq("id", existingReaction.id)
          .select()
          .single();
        if (error) throw error;
        return { action: "updated" as const, data };
      }

      const { data, error } = await supabase
        .from("post_reactions" as any)
        .insert({
          user_id: user.id,
          post_id: postId,
          comment_id: null,
          type,
          sticker_id: null,
        })
        .select()
        .single();
      if (error) throw error;
      return { action: "inserted" as const, data };
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
      void queryClient.invalidateQueries({ queryKey: ["post_reactions", "post", variables.postId] });
    },
  });
};
