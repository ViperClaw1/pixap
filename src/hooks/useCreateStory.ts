import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CreateStoryInput {
  placeId: string;
  content: string;
  mediaUrl?: string | null;
}

export const useCreateStory = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ placeId, content, mediaUrl }: CreateStoryInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const text = content.trim();
      if (!text) throw new Error("Story content cannot be empty");

      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stories table may not be present in generated types yet
        .from("stories" as any)
        .insert({
          user_id: user.id,
          place_id: placeId,
          content: text,
          media_url: mediaUrl?.trim() ? mediaUrl.trim() : null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["stories", "place", variables.placeId] });
    },
  });
};
