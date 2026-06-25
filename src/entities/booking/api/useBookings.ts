import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import type { CartItem } from "@/entities/cart";
import { BOOKINGS_SELECT, localizeBusinessCard } from "@/entities/business-card";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";
import { normalizeBusinessCardBlurhashes } from "@/shared/lib/business-card/businessCardBlurhash";
import { suppressBookingStatusNotification } from "../lib/bookingDisplayStatusTracker";
import { isWaVenueUnavailable } from "../lib/waVenueStatus";

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
    blurhashes?: string[] | null;
    address: string;
    category_id: string | null;
    external_booking_platform?: string | null;
    external_booking_url?: string | null;
  } | null;
}

/** Paid booking: upcoming if due_date >= now, else completed. */
export function bookingScheduleLabel(dateTimeIso: string): "upcoming" | "completed" {
  return new Date(dateTimeIso).getTime() >= Date.now() ? "upcoming" : "completed";
}

export type BookingDisplayStatus = "draft" | "confirmed" | "cancelled" | "completed" | "payment awaiting";

export { isWaVenueUnavailable } from "../lib/waVenueStatus";

function deriveWaLinkedDisplayStatus(linkedCartItem: CartItem): BookingDisplayStatus {
  if ((linkedCartItem.wa_payment_link?.trim()?.length ?? 0) > 0) {
    return "payment awaiting";
  }
  if (linkedCartItem.wa_confirmable) {
    return "confirmed";
  }
  return "draft";
}

/** Past slot: show under Completed, not Confirmed. */
function applyPastConfirmedAsCompleted(
  status: BookingDisplayStatus,
  dateTimeIso: string,
): BookingDisplayStatus {
  if (status === "confirmed" && new Date(dateTimeIso).getTime() < Date.now()) {
    return "completed";
  }
  return status;
}

export function deriveBookingDisplayStatus(booking: Booking, linkedCartItem?: CartItem | null): BookingDisplayStatus {
  let status: BookingDisplayStatus;

  if (booking.status === "expired") {
    status = "cancelled";
  } else if (isWaVenueUnavailable(linkedCartItem)) {
    status = "cancelled";
  } else if (linkedCartItem?.status === "created") {
    status = deriveWaLinkedDisplayStatus(linkedCartItem);
  } else if (booking.payment_status === "pending") {
    status = linkedCartItem ? deriveWaLinkedDisplayStatus(linkedCartItem) : "draft";
  } else if (new Date(booking.date_time).getTime() < Date.now()) {
    status = "completed";
  } else {
    status = "confirmed";
  }

  return applyPastConfirmedAsCompleted(status, booking.date_time);
}

export const useBookings = (options?: { enabled?: boolean }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const language = i18n.language;

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`bookings_user_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `user_id=eq.${user.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.prefix });
          void queryClient.invalidateQueries({ queryKey: queryKeys.cart.itemsPrefix });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

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
                blurhashes: normalizeBusinessCardBlurhashes(row.business_card.blurhashes),
              },
              language,
            )
          : null,
      }));
      return rows;
    },
    enabled: !!user && (options?.enabled ?? true),
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
      return data as { id: string };
    },
    onSuccess: (data) => {
      if (user?.id && data?.id) {
        suppressBookingStatusNotification(user.id, data.id);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.prefix });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookingCredits.prefix });
      queryClient.invalidateQueries({ queryKey: queryKeys.availableSlots.prefix });
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
    onSuccess: (_data, bookingId) => {
      if (user?.id) {
        suppressBookingStatusNotification(user.id, bookingId);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.prefix });
      queryClient.invalidateQueries({ queryKey: queryKeys.availableSlots.prefix });
    },
  });
};
