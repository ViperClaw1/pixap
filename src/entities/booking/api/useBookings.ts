import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import type { CartItem } from "@/entities/cart";
import { BOOKINGS_SELECT, localizeBusinessCard } from "@/entities/business-card";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";

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

function waVenueStatusText(linkedCartItem?: CartItem | null): string {
  return (Array.isArray(linkedCartItem?.wa_status_lines) ? linkedCartItem.wa_status_lines : [])
    .filter((x): x is string => typeof x === "string")
    .join(" ")
    .toLowerCase();
}

function isWaVenueUnavailable(linkedCartItem?: CartItem | null): boolean {
  const text = waVenueStatusText(linkedCartItem);
  return (
    text.includes("not available") ||
    text.includes("unavailable") ||
    text.includes("slot is not available") ||
    text.includes("недоступен") ||
    text.includes("отклон")
  );
}

function deriveWaLinkedDisplayStatus(linkedCartItem: CartItem): BookingDisplayStatus {
  if ((linkedCartItem.wa_payment_link?.trim()?.length ?? 0) > 0) {
    return "payment awaiting";
  }
  if (linkedCartItem.wa_confirmable) {
    return "confirmed";
  }
  return "draft";
}

export function deriveBookingDisplayStatus(booking: Booking, linkedCartItem?: CartItem | null): BookingDisplayStatus {
  if (booking.status === "expired") return "cancelled";
  if (isWaVenueUnavailable(linkedCartItem)) return "cancelled";

  if (linkedCartItem?.status === "created") {
    return deriveWaLinkedDisplayStatus(linkedCartItem);
  }

  if (booking.payment_status === "pending") {
    if (linkedCartItem) return deriveWaLinkedDisplayStatus(linkedCartItem);
    return "draft";
  }

  if (new Date(booking.date_time).getTime() < Date.now()) return "completed";
  return "confirmed";
}

export const useBookings = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useQuery({
    queryKey: queryKeys.bookings.user(user?.id, language),
    queryFn: async () => {
      const query = supabase
        .from("bookings")
        .select(BOOKINGS_SELECT as never)
        .eq("user_id", user!.id)
        .order("date_time", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      const rows = ((data ?? []) as unknown as Booking[]).map((row) => ({
        ...row,
        business_card: row.business_card
          ? localizeBusinessCard(
              {
                ...row.business_card,
                images: normalizeBusinessCardImages(row.business_card.images),
              },
              language,
            )
          : null,
      }));
      return rows;
    },
    enabled: !!user,
    staleTime: 30 * 1000,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.prefix });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookingCredits.prefix });
    },
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.bookings.prefix }),
  });
};
