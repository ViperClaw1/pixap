import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Booking {
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
  /** Legacy column; schedule tabs use `date_time` vs now. */
  status: "upcoming" | "completed" | "expired";
  payment_status: "paid" | "pending";
  created_at: string;
  business_card?: {
    id: string;
    name: string;
    image: string;
    address: string;
    category_id: string | null;
  } | null;
}

/** Paid booking: upcoming if due_date >= now, else completed. */
export function bookingScheduleLabel(dateTimeIso: string): "upcoming" | "completed" {
  return new Date(dateTimeIso).getTime() >= Date.now() ? "upcoming" : "completed";
}

export type BookingsTabFilter = undefined | "upcoming" | "completed";

export const useBookings = (tab?: BookingsTabFilter) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bookings", user?.id, tab],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      let query = supabase
        .from("bookings")
        .select("*, business_card:business_cards(id, name, image, address, category_id)")
        .eq("user_id", user!.id)
        .order("date_time", { ascending: false });
      if (tab === "upcoming") query = query.gte("date_time", nowIso);
      if (tab === "completed") query = query.lt("date_time", nowIso);
      const { data, error } = await query;
      if (error) throw error;
      return data as Booking[];
    },
    enabled: !!user,
  });
};

export const useCreateBooking = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (booking: {
      business_card_id: string;
      date_time: string;
      cost: number;
      persons?: number | null;
      customer_name?: string | null;
      customer_phone?: string | null;
      customer_email?: string | null;
      comment?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          ...booking,
          user_id: user!.id,
          status: "upcoming" as const,
          payment_status: "pending" as const,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
};
