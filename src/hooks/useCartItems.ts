import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CartItem {
  id: string;
  user_id: string;
  business_card_id: string;
  date_time: string;
  cost: number;
  persons: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  comment: string | null;
  is_restaurant_table: boolean;
  status: "created" | "paid" | "expired";
  created_at: string;
  paid_at: string | null;
  business_card?: {
    id: string;
    name: string;
    image: string;
    address: string;
    category_id: string | null;
    contact_whatsapp?: string | null;
  } | null;
}

export const useCartItems = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cart_items", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("*, business_card:business_cards(id, name, image, address, category_id, contact_whatsapp)")
        .eq("user_id", user!.id)
        .eq("status", "created")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CartItem[];
    },
    enabled: !!user,
  });
};

export const useCreateCartItem = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: {
      business_card_id: string;
      date_time: string;
      cost: number;
      persons?: number | null;
      customer_name?: string | null;
      customer_phone?: string | null;
      customer_email?: string | null;
      comment?: string | null;
      is_restaurant_table?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("cart_items")
        .insert({
          ...item,
          user_id: user!.id,
          status: "created" as const,
          is_restaurant_table: item.is_restaurant_table ?? false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart_items"] }),
  });
};

export const useDeleteCartItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cart_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart_items"] }),
  });
};
