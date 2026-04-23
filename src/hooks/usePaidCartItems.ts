import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CartItem } from "@/hooks/useCartItems";

export const usePaidCartItems = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["paid_cart_items", user?.id],
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
  });
};
