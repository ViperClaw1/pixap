import { isCategoryBookingAllowed } from "@/entities/category";
import { supabase } from "@/shared/api/supabase/client";

export class CategoryBookingNotAllowedError extends Error {
  constructor() {
    super("Booking is not available for this category");
    this.name = "CategoryBookingNotAllowedError";
  }
}

export async function assertBusinessCardBookingAllowed(businessCardId: string): Promise<void> {
  const { data, error } = await supabase
    .from("business_cards")
    .select("category:categories(name)")
    .eq("id", businessCardId)
    .maybeSingle();

  if (error) throw error;

  const category = (data as unknown as { category: { name: string } | null } | null)?.category;
  if (!isCategoryBookingAllowed(category?.name)) {
    throw new CategoryBookingNotAllowedError();
  }
}
