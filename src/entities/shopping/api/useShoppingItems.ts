import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SHOPPING_CART_SELECT, localizeBusinessCard } from "@/entities/business-card";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";

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
    queryKey: queryKeys.shoppingItems.main(businessCardId),
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
    queryKey: queryKeys.shoppingItems.additional(businessCardId),
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
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useQuery({
    queryKey: queryKeys.shopping.cart(user?.id, language),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_cart_items")
        .select(SHOPPING_CART_SELECT as never)
        .eq("user_id", user!.id)
        .eq("status", "created")
        .order("created_at");
      if (error) throw error;

      type ShoppingCartRow = Omit<ShoppingCartItem, "shopping_item" | "children"> & {
        shopping_item: ShoppingItem | null;
        business_card: Parameters<typeof localizeBusinessCard>[0] | null;
      };
      const items = ((data ?? []) as unknown as ShoppingCartRow[]).map((row) => ({
        ...row,
        business_card: row.business_card ? localizeBusinessCard(row.business_card, language) : null,
      })) as ShoppingCartRow[];

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
    staleTime: 20 * 1000,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shopping.cartPrefix }),
  });
};

export const useUpdateShoppingCartQuantity = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from("shopping_cart_items").update({ quantity }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shopping.cartPrefix }),
  });
};

export const useRemoveShoppingCartItem = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_cart_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shopping.cartPrefix }),
  });
};
