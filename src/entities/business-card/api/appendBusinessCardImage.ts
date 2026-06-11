import { supabase } from "@/shared/api/supabase/client";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";

export async function appendBusinessCardImage(venueId: string, imageUrl: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("append_business_card_image", {
    p_venue_id: venueId,
    p_image_url: imageUrl,
  });

  if (error) throw error;
  return normalizeBusinessCardImages(data);
}
