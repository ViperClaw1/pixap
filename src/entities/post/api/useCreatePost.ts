import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/contexts/AuthContext";

interface CreatePostGeoPayload {
  placeName: string | null;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  googlePlaceId?: string | null;
}

interface CreatePostInput {
  placeId?: string | null;
  geo?: CreatePostGeoPayload | null;
  content: string;
  mediaUrl?: string | null;
  mediaBlurhashes?: (string | null)[] | null;
}

export const useCreatePost = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ placeId, geo, content, mediaUrl, mediaBlurhashes }: CreatePostInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const text = content.trim();
      if (!text) throw new Error("Post content cannot be empty");

      const hasPlace = Boolean(placeId?.trim());
      const hasGeo =
        geo &&
        typeof geo.latitude === "number" &&
        typeof geo.longitude === "number" &&
        geo.formattedAddress.trim().length > 0;

      if (!hasPlace && !hasGeo) throw new Error("Place or address is required");
      if (hasPlace && hasGeo) throw new Error("Cannot set both place and standalone geo");

      const row: Record<string, unknown> = {
        user_id: user.id,
        content: text,
        media_url: mediaUrl?.trim() ? mediaUrl.trim() : null,
      };
      if (mediaBlurhashes != null && mediaBlurhashes.length > 0) {
        row.media_blurhashes = mediaBlurhashes;
      }

      if (hasPlace) {
        row.place_id = placeId!.trim();
        // Do not send geo_* keys: older DBs without migration 20260513 lack these columns;
        // PostgREST rejects unknown columns even when null.
      } else if (hasGeo) {
        row.place_id = null;
        row.geo_place_name = geo!.placeName?.trim() ? geo!.placeName!.trim() : null;
        row.geo_formatted_address = geo!.formattedAddress.trim();
        row.geo_latitude = geo!.latitude;
        row.geo_longitude = geo!.longitude;
        row.geo_google_place_id = geo!.googlePlaceId?.trim() ? geo!.googlePlaceId!.trim() : null;
      }

      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- posts table may not be present in generated types yet
        .from("posts" as any)
        .insert(row)
        .select()
        .single();

      if (error) {
        const msg = typeof error.message === "string" ? error.message : "";
        if (
          msg.includes("geo_formatted_address") ||
          msg.includes("geo_place_name") ||
          msg.includes("geo_latitude")
        ) {
          throw new Error(
            "В Supabase не применена миграция geo для постов без места. Выполните SQL из файла supabase/migrations/20260513_posts_optional_place_geo.sql (Dashboard → SQL или `supabase db push`), затем повторите публикацию.",
            { cause: error },
          );
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.feedPrefix });
      if (variables.placeId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.posts.place(variables.placeId.trim()) });
      }
    },
  });
};
