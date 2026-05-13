import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

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
  category?: { id: string; name: string } | null;
}

export const useBusinessCards = (type?: "featured" | "recommended", city?: string | null) => {
  return useQuery({
    queryKey: queryKeys.businessCards.list(type, city ?? null),
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from("business_cards")
        .select(
          "id, name, images, category_id, city, address, rating, tags, description, booking_price, phone, contact_whatsapp, type, created_at, category:categories(id, name)",
        )
        .order("created_at", { ascending: false })
        .limit(BUSINESS_CARDS_STARTUP_LIMIT);
      if (type) query = query.eq("type", type);
      if (city && city !== ALL_CITIES_OPTION) query = query.eq("city", city);
      const { data, error } = await query;
      if (error) throw error;
      return data as BusinessCard[];
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
  return useQuery({
    queryKey: queryKeys.businessCards.byId(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_cards")
        .select("*, category:categories(id, name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as BusinessCard;
    },
    enabled: !!id,
  });
};

export const useBusinessCardsByCategory = (categoryId: string) => {
  return useQuery({
    queryKey: queryKeys.businessCards.byCategory(categoryId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_cards")
        .select("*, category:categories(id, name)")
        .eq("category_id", categoryId);
      if (error) throw error;
      return data as BusinessCard[];
    },
    enabled: !!categoryId,
  });
};
