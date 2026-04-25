import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["story_comments", "story", variables.storyId] });
      void queryClient.invalidateQueries({ queryKey: ["stories"] });
    },
  });
};
