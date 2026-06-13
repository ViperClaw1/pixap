import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { BOOKINGS_SELECT, localizeBusinessCard } from "@/entities/business-card";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";
import { normalizeBusinessCardBlurhashes } from "@/shared/lib/business-card/businessCardBlurhash";
import type { Booking } from "./useBookings";

export function useBooking(bookingId: string | undefined) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useQuery({
    queryKey: queryKeys.bookings.detail(user?.id, bookingId, language),
    queryFn: async (): Promise<Booking | null> => {
      const { data, error } = await supabase
        .from("bookings")
        .select(BOOKINGS_SELECT as never)
        .eq("id", bookingId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const row = data as unknown as Booking;
      return {
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
      };
    },
    enabled: Boolean(user?.id && bookingId),
    staleTime: 30 * 1000,
  });
}
