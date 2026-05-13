import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
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
}

export const useCreatePost = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ placeId, geo, content, mediaUrl }: CreatePostInput) => {
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

      if (hasPlace) {
        row.place_id = placeId!.trim();
        row.geo_place_name = null;
        row.geo_formatted_address = null;
        row.geo_latitude = null;
        row.geo_longitude = null;
        row.geo_google_place_id = null;
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

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
      if (variables.placeId) {
        void queryClient.invalidateQueries({ queryKey: ["posts", "place", variables.placeId] });
      }
    },
  });
};
