import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { BUSINESS_CARD_LIST_SELECT, localizeBusinessCard } from "../lib/localizeBusinessCard";

export const ALL_CITIES_OPTION = "All cities";
const BUSINESS_CARDS_STARTUP_LIMIT = 120;

export interface BusinessCard {
  id: string;
  name: string;
  images: string[];
  category_id: string | null;
  city: string | null;
  address: string;
  rating: number;
  tags: string[];
  description: string;
  booking_price: number;
  phone: string;
  contact_whatsapp?: string | null;
  type: "featured" | "recommended";
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  category?: { id: string; name: string } | null;
}

export const useBusinessCards = (type?: "featured" | "recommended", city?: string | null) => {
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useQuery({
    queryKey: queryKeys.businessCards.list(type, city ?? null, language),
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from("business_cards")
        .select(BUSINESS_CARD_LIST_SELECT as never)
        .order("created_at", { ascending: false })
        .limit(BUSINESS_CARDS_STARTUP_LIMIT);
      if (type) query = query.eq("type", type);
      if (city && city !== ALL_CITIES_OPTION) query = query.eq("city", city);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as unknown as Parameters<typeof localizeBusinessCard>[0][]).map((row) =>
        localizeBusinessCard(row, language),
      ) as BusinessCard[];
    },
  });
};

export const useAvailableCities = () => {
  return useQuery({
    queryKey: queryKeys.businessCards.availableCities,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_cards")
        .select("city")
        .not("city", "is", null)
        .order("city", { ascending: true })
        .limit(500);
      if (error) throw error;
      const unique = Array.from(
        new Set((data ?? []).map((row) => row.city).filter((city): city is string => typeof city === "string" && city.trim().length > 0)),
      );
      return [ALL_CITIES_OPTION, ...unique];
    },
  });
};

export const useBusinessCard = (id: string) => {
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useQuery({
    queryKey: queryKeys.businessCards.byId(id, language),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_cards")
        .select("*, category:categories(id, name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return localizeBusinessCard(
        data as Parameters<typeof localizeBusinessCard>[0],
        language,
      ) as BusinessCard;
    },
    enabled: !!id,
  });
};

export const useBusinessCardsByCategory = (categoryId: string, city?: string | null) => {
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useQuery({
    queryKey: queryKeys.businessCards.byCategory(categoryId, city ?? null, language),
    queryFn: async () => {
      let query = supabase
        .from("business_cards")
        .select("*, category:categories(id, name)")
        .eq("category_id", categoryId);
      if (city && city !== ALL_CITIES_OPTION) query = query.eq("city", city);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as unknown as Parameters<typeof localizeBusinessCard>[0][]).map((row) =>
        localizeBusinessCard(row, language),
      ) as BusinessCard[];
    },
    enabled: !!categoryId,
  });
};
