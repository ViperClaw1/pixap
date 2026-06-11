import { supabase } from "@/shared/api/supabase/client";
import {
  BUSINESS_CARD_GALLERY_FILE,
  BUSINESS_CARD_HERO_FILE,
  BUSINESS_CARD_THUMB_FILE,
  businessCardStorageObjectPath,
} from "@/shared/lib/business-card/businessCardPregenStorage";
import { isUserOwnedBusinessCardImageUrl } from "@/shared/lib/business-card/userOwnedBusinessCardImage";
import { BUSINESS_CARDS_BUCKET } from "./uploadBusinessCardImage";

export function collectBusinessCardImageStoragePaths(imageUrl: string): string[] {
  const primaryPath = businessCardStorageObjectPath(imageUrl);
  if (!primaryPath) return [];

  const paths = new Set<string>([primaryPath]);
  for (const pregenFile of [BUSINESS_CARD_THUMB_FILE, BUSINESS_CARD_HERO_FILE, BUSINESS_CARD_GALLERY_FILE]) {
    paths.add(primaryPath.replace(/\.[^./]+$/i, pregenFile));
  }
  return [...paths];
}

export async function deleteBusinessCardImageFromStorage(
  imageUrl: string,
  userId: string,
): Promise<void> {
  if (!isUserOwnedBusinessCardImageUrl(imageUrl, userId)) return;

  const paths = collectBusinessCardImageStoragePaths(imageUrl);
  if (!paths.length) return;

  const { error } = await supabase.storage.from(BUSINESS_CARDS_BUCKET).remove(paths);
  if (error) throw error;
}
