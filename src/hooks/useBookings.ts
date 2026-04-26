import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CartItem } from "@/hooks/useCartItems";

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
    images: string[] | null;
    address: string;
    category_id: string | null;
  } | null;
}

/** Paid booking: upcoming if due_date >= now, else completed. */
export function bookingScheduleLabel(dateTimeIso: string): "upcoming" | "completed" {
  return new Date(dateTimeIso).getTime() >= Date.now() ? "upcoming" : "completed";
}

export type BookingDisplayStatus = "draft" | "confirmed" | "cancelled" | "completed" | "payment awaiting";

export function deriveBookingDisplayStatus(booking: Booking, linkedCartItem?: CartItem | null): BookingDisplayStatus {
  if (booking.status === "expired") return "cancelled";
  const venueStatusText = (Array.isArray(linkedCartItem?.wa_status_lines) ? linkedCartItem.wa_status_lines : [])
    .filter((x): x is string => typeof x === "string")
    .join(" ")
    .toLowerCase();
  if (
    venueStatusText.includes("not available") ||
    venueStatusText.includes("unavailable") ||
    venueStatusText.includes("slot is not available")
  ) {
    return "cancelled";
  }
  if (booking.payment_status === "pending") {
    if (linkedCartItem?.wa_confirmable || (linkedCartItem?.wa_payment_link?.trim()?.length ?? 0) > 0) {
      return "confirmed";
    }
    return "draft";
  }
  if (new Date(booking.date_time).getTime() < Date.now()) return "completed";
  return "confirmed";
}

export const useBookings = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bookings", user?.id],
    queryFn: async () => {
      const query = supabase
        .from("bookings")
        .select("*, business_card:business_cards(id, name, images, address, category_id)")
        .eq("user_id", user!.id)
        .order("date_time", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data as Booking[]).map((row) => ({
        ...row,
        business_card: row.business_card
          ? {
              ...row.business_card,
              images: row.business_card.images,
            }
          : null,
      }));
      return rows;
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
      payment_status?: "pending" | "paid";
      status?: "upcoming" | "completed" | "expired";
    }) => {
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          ...booking,
          user_id: user!.id,
          status: booking.status ?? ("upcoming" as const),
          payment_status: booking.payment_status ?? ("pending" as const),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
};

export const useCancelBooking = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "expired" as const })
        .eq("id", bookingId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
};
