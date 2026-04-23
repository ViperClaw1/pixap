import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ShoppingCartItem, ShoppingItem } from "@/hooks/useShoppingItems";

function buildPaidShoppingTree(
  rows: (Omit<ShoppingCartItem, "shopping_item" | "children"> & {
    shopping_item: ShoppingItem | null;
  })[],
): ShoppingCartItem[] {
  const mainItems: ShoppingCartItem[] = [];
  const childMap = new Map<string, ShoppingCartItem[]>();

  for (const item of rows) {
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

  mainItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return mainItems;
}

export const usePaidShoppingCartItems = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["paid_shopping_cart_items", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_cart_items")
        .select("*, shopping_item:shopping_items(*), business_card:business_cards(id, name, images)")
        .eq("user_id", user!.id)
        .eq("status", "paid");
      if (error) throw error;
      const items = data as (Omit<ShoppingCartItem, "shopping_item" | "children"> & {
        shopping_item: ShoppingItem | null;
      })[];
      return buildPaidShoppingTree(items);
    },
    enabled: !!user,
  });
};
