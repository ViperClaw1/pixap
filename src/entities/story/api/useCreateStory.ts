import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { normalizeOptionalUuid } from "@/shared/lib/normalizeOptionalUuid";
import { parseSupabaseRowWithId, type SupabaseRowWithId } from "@/shared/lib/supabase/parseSupabaseRow";

interface CreateStoryInput {
  /** Null when the story is not tied to a business listing (e.g. from address-only post). */
  placeId: string | null;
  content: string;
  mediaUrl?: string | null;
  expiryTime?: string;
  mediaBlurhashes?: (string | null)[] | null;
}

export const useCreateStory = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ placeId, content, mediaUrl, expiryTime, mediaBlurhashes }: CreateStoryInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const text = content.trim();
      const normalizedPlaceId = normalizeOptionalUuid(placeId);

      const insertRow: Record<string, unknown> = {
        user_id: user.id,
        place_id: normalizedPlaceId,
        // Keep content optional for story-from-post flow while preserving non-empty DB writes.
        content: text || " ",
        media_url: mediaUrl?.trim() ? mediaUrl.trim() : null,
        expiry_time: expiryTime ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      if (mediaBlurhashes != null && mediaBlurhashes.length > 0) {
        insertRow.media_blurhashes = mediaBlurhashes;
      }

      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stories table may not be present in generated types yet
        .from("stories" as any)
        .insert(insertRow)
        .select()
        .single();

      if (error) throw error;
      return parseSupabaseRowWithId(data) satisfies SupabaseRowWithId;
    },
    onSuccess: (_data, variables) => {
      const placeForCache = normalizeOptionalUuid(variables.placeId);
      if (placeForCache) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.stories.placePrefix(placeForCache) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.stories.strip });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stories.feedPrefix });
    },
  });
};
