import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

/** Community place attached to a feed post — minimal required catalogue fields */
export interface CreateCommunityBusinessCardInput {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  images: string[];
  city?: string | null;
}

export const useCreateBusinessCardFromGeocode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCommunityBusinessCardInput) => {
      const row = {
        name: input.name.trim(),
        address: input.address.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        images: input.images,
        city: input.city?.trim() || null,
        phone: "—",
        rating: 0,
        booking_price: 0,
        type: "recommended" as const,
        tags: [] as string[],
        description: null as string | null,
      };
      const { data, error } = await supabase.from("business_cards").insert(row).select("id").single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.businessCards.listPrefix });
      void queryClient.invalidateQueries({ queryKey: queryKeys.businessCards.singlePrefix });
    },
  });
};
