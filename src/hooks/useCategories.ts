import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  id: string;
  name: string;
  business_cards_count: number;
  icon?: string;
}

const categoryIcons: Record<string, string> = {
  Restaurants: "🍽️",
  Beauty: "💆",
  Events: "🎭",
  Shopping: "🛍️",
};

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*");
      if (error) throw error;
      return (data as Category[]).map((c) => ({
        ...c,
        icon: categoryIcons[c.name] || "📌",
      }));
    },
  });
};
