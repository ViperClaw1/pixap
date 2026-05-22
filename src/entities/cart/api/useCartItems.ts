import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { CART_ITEMS_SELECT, localizeBusinessCard } from "@/entities/business-card";

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
  wa_n8n_callback_token: string | null;
  wa_n8n_started_at: string | null;
  wa_status_lines: unknown;
  wa_confirmable: boolean;
  wa_confirmed_slot: string | null;
  wa_confirmed_price: string | null;
  wa_payment_link: string | null;
  business_card?: {
    id: string;
    name: string;
    images: string[] | null;
    address: string;
    category_id: string | null;
    contact_whatsapp?: string | null;
  } | null;
}

export function parseWaStatusLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === "string") out.push(x);
  }
  return out;
}

export const useCartItems = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const language = i18n.language;

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`cart_items_user_${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cart_items", filter: `user_id=eq.${user.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.cart.itemsPrefix });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return useQuery({
    queryKey: queryKeys.cart.items(user?.id, language),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select(CART_ITEMS_SELECT as never)
        .eq("user_id", user!.id)
        .eq("status", "created")
        .order("created_at", { ascending: false });
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
    staleTime: 20 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const list = query.state.data as CartItem[] | undefined;
      if (!list?.length) return false;
      return list.some((i) => i.wa_n8n_started_at && !i.wa_confirmable) ? 5000 : false;
    },
  });
};

export const useConfirmServiceCartBooking = () => {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  return useMutation({
    mutationFn: async ({ cartItemId, action }: { cartItemId: string; action: "confirm" | "pay" }) => {
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const { data, error } = await supabase.functions.invoke("confirm-service-cart-booking", {
        body: { cart_item_id: cartItemId, action },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw new Error(error.message);
      const payload = data as { error?: string; ok?: boolean };
      if (payload && typeof payload === "object" && payload.error) {
        throw new Error(String(payload.error));
      }
      return payload;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart.itemsPrefix });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.prefix });
    },
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cart.itemsPrefix }),
  });
};

export const useDeleteCartItem = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cart_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cart.itemsPrefix }),
  });
};
