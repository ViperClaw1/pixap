import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { FAVORITES_SELECT, localizeBusinessCard } from "@/entities/business-card";

export const useFavorites = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useQuery({
    queryKey: queryKeys.favorites.user(user?.id, language),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select(FAVORITES_SELECT as never)
        .eq("user_id", user!.id);
      if (error) throw error;
      type FavoriteRow = {
        id: string;
        user_id: string;
        business_card_id: string;
        created_at: string;
        business_card: Parameters<typeof localizeBusinessCard>[0] | null;
      };
      return ((data ?? []) as unknown as FavoriteRow[]).map((row) => ({
        ...row,
        business_card: row.business_card ? localizeBusinessCard(row.business_card, language) : null,
      }));
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
