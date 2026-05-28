import { supabase } from "@/shared/api/supabase/client";
import { localizeBusinessCard } from "../lib/localizeBusinessCard";
import type { BusinessCard } from "./useBusinessCards";

export async function fetchBusinessCardById(id: string, language: string): Promise<BusinessCard> {
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
}
