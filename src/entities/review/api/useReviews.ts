import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

export interface Review {
  id: string;
  business_card_id: string;
  value: number;
  description: string;
  created_at: string;
}

export const useReviews = (businessCardId: string) => {
  return useQuery({
    queryKey: queryKeys.reviews.byBusinessCard(businessCardId),
    queryFn: async () => {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB view not in generated table union
        .from("public_reviews" as any)
        .select("id, business_card_id, value, description, created_at")
        .eq("business_card_id", businessCardId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Review[];
    },
    enabled: !!businessCardId,
    staleTime: 90 * 1000,
  });
};
