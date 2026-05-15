import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import type { CartItem } from "./useCartItems";

export const usePaidCartItems = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.cart.paidItems(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("*, business_card:business_cards(id, name, images, address, category_id, contact_whatsapp)")
        .eq("user_id", user!.id)
        .eq("status", "paid")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data as CartItem[];
    },
    enabled: !!user,
    staleTime: 45 * 1000,
  });
};
