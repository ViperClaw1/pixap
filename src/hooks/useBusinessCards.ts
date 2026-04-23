import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const ALL_CITIES_OPTION = "All cities";

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
    queryKey: ["business_cards", type, city ?? null],
    queryFn: async () => {
      let query = supabase
        .from("business_cards")
        .select("*, category:categories(id, name)")
        .order("created_at", { ascending: false });
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
    queryKey: ["business_cards", "available_cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_cards")
        .select("city")
        .not("city", "is", null)
        .order("city", { ascending: true });
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
    queryKey: ["business_card", id],
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
    queryKey: ["business_cards", "category", categoryId],
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
