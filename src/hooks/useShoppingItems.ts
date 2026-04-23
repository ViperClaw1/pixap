import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ShoppingItem {
  id: string;
  business_card_id: string;
  name: string;
  image: string;
  price: number;
  item_type: "main" | "sauce" | "beverage";
  created_at: string;
}

export interface ShoppingCartItem {
  id: string;
  user_id: string;
  shopping_item_id: string;
  business_card_id: string;
  quantity: number;
  parent_id: string | null;
  created_at: string;
  shopping_item?: ShoppingItem | null;
  /** Joined for cart thumbnails when product image is empty. */
  business_card?: { id: string; name: string; images: string[] | null; contact_whatsapp?: string | null } | null;
  children?: ShoppingCartItem[];
  status?: string;
  paid_at?: string | null;
}

export const useShoppingItems = (businessCardId: string) => {
  return useQuery({
    queryKey: ["shopping_items", businessCardId, "main"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("*")
        .eq("business_card_id", businessCardId)
        .eq("item_type", "main")
        .order("created_at");
      if (error) throw error;
      return data as ShoppingItem[];
    },
    enabled: !!businessCardId,
  });
};

export const useAdditionalItems = (businessCardId: string) => {
  return useQuery({
    queryKey: ["shopping_items", businessCardId, "additional"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("*")
        .eq("business_card_id", businessCardId)
        .in("item_type", ["sauce", "beverage"])
        .order("item_type")
        .order("name");
      if (error) throw error;
      return data as ShoppingItem[];
    },
    enabled: !!businessCardId,
  });
};

export const useShoppingCart = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["shopping_cart", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_cart_items")
        .select("*, shopping_item:shopping_items(*), business_card:business_cards(id, name, images, contact_whatsapp)")
        .eq("user_id", user!.id)
        .eq("status", "created")
        .order("created_at");
      if (error) throw error;

      const items = data as (Omit<ShoppingCartItem, "shopping_item" | "children"> & {
        shopping_item: ShoppingItem | null;
      })[];

      const mainItems: ShoppingCartItem[] = [];
      const childMap = new Map<string, ShoppingCartItem[]>();

      for (const item of items) {
        if (item.parent_id) {
          const arr = childMap.get(item.parent_id) || [];
          arr.push({ ...item, children: [] });
          childMap.set(item.parent_id, arr);
        } else {
          mainItems.push({ ...item, children: [] });
        }
      }

      for (const main of mainItems) {
        main.children = childMap.get(main.id) || [];
      }

      return mainItems;
    },
    enabled: !!user,
  });
};

export const useAddToShoppingCart = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      items: {
        shopping_item_id: string;
        business_card_id: string;
        quantity: number;
        parent_id?: string | null;
      }[],
    ) => {
      const rows = items.map((i) => ({
        ...i,
        user_id: user!.id,
        parent_id: i.parent_id || null,
      }));
      const { data, error } = await supabase.from("shopping_cart_items").insert(rows).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shopping_cart"] }),
  });
};

export const useUpdateShoppingCartQuantity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from("shopping_cart_items").update({ quantity }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shopping_cart"] }),
  });
};

export const useRemoveShoppingCartItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_cart_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shopping_cart"] }),
  });
};
