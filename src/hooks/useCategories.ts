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

function dedupeCategoriesByName(rows: Category[]): Category[] {
  const byKey = new Map<string, Category>();
  for (const c of rows) {
    const key = c.name.trim().toLowerCase();
    const prev = byKey.get(key);
    if (!prev || c.business_cards_count > prev.business_cards_count) {
      byKey.set(key, c);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*");
      if (error) throw error;
      const withIcons = (data as Category[]).map((c) => ({
        ...c,
        icon: categoryIcons[c.name] || "📌",
      }));
      return dedupeCategoriesByName(withIcons);
    },
  });
};
