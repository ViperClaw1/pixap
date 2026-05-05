import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CreatePostInput {
  placeId: string;
  content: string;
  mediaUrl?: string | null;
}

export const useCreatePost = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ placeId, content, mediaUrl }: CreatePostInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const text = content.trim();
      if (!text) throw new Error("Post content cannot be empty");

      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- posts table may not be present in generated types yet
        .from("posts" as any)
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
    },
  });
};
