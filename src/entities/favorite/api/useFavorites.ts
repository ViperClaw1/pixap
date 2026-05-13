import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/contexts/AuthContext";

export const useFavorites = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.favorites.user(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("*, business_card:business_cards(id, name, images, address, rating, tags, booking_price, type)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useIsFavorite = (businessCardId: string) => {
  const { data: favorites } = useFavorites();
  return favorites?.some((f) => f.business_card_id === businessCardId) ?? false;
};

export const useToggleFavorite = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ businessCardId, isFavorite }: { businessCardId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user!.id)
          .eq("business_card_id", businessCardId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: user!.id, business_card_id: businessCardId });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.favorites.prefix }),
  });
};
