import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { SHOPPING_CART_SELECT, localizeBusinessCard } from "@/entities/business-card";
import type { ShoppingCartItem, ShoppingItem } from "./useShoppingItems";

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
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useQuery({
    queryKey: queryKeys.shopping.paidCartItems(user?.id, language),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_cart_items")
        .select(SHOPPING_CART_SELECT as never)
        .eq("user_id", user!.id)
        .eq("status", "paid");
      if (error) throw error;
      type ShoppingCartRow = Omit<ShoppingCartItem, "shopping_item" | "children"> & {
        shopping_item: ShoppingItem | null;
        business_card: Parameters<typeof localizeBusinessCard>[0] | null;
      };
      const items = ((data ?? []) as unknown as ShoppingCartRow[]).map((row) => ({
        ...row,
        business_card: row.business_card ? localizeBusinessCard(row.business_card, language) : null,
      })) as ShoppingCartRow[];
      return buildPaidShoppingTree(items);
    },
    enabled: !!user,
  });
};
