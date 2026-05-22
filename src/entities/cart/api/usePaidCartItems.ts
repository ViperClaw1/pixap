import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { CART_ITEMS_SELECT, localizeBusinessCard } from "@/entities/business-card";
import type { CartItem } from "./useCartItems";

export const usePaidCartItems = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useQuery({
    queryKey: queryKeys.cart.paidItems(user?.id, language),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select(CART_ITEMS_SELECT as never)
        .eq("user_id", user!.id)
        .eq("status", "paid")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      type CartRow = CartItem & {
        business_card: Parameters<typeof localizeBusinessCard>[0] | null;
      };
      return ((data ?? []) as unknown as CartRow[]).map((row) => ({
        ...row,
        business_card: row.business_card ? localizeBusinessCard(row.business_card, language) : null,
      })) as CartItem[];
    },
    enabled: !!user,
    staleTime: 45 * 1000,
  });
};
