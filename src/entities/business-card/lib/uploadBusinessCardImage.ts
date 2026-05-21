import type { ImagePickerAsset } from "expo-image-picker";
import { supabase } from "@/shared/api/supabase/client";
import {
  POST_STORAGE_MAX_LONG_EDGE,
  prepareImageForStorageUpload,
} from "@/shared/lib/prepareImageForStorageUpload";
import { buildStorageUploadOptions } from "@/shared/lib/storageUploadOptions";

export const BUSINESS_CARDS_BUCKET = "business-cards";

export async function uploadBusinessCardImage(
  asset: ImagePickerAsset,
  userId: string,
): Promise<string> {
  const { bytes, contentType, fileExtension } = await prepareImageForStorageUpload(asset, {
    maxLongEdgePx: POST_STORAGE_MAX_LONG_EDGE,
    format: "webp",
  });
  if (!bytes.byteLength) {
    throw new Error("Selected image is empty. Please try another photo.");
  }

  const path = `${userId}/venue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExtension}`;
  const { error } = await supabase.storage.from(BUSINESS_CARDS_BUCKET).upload(
    path,
    bytes,
    buildStorageUploadOptions(contentType, "immutable"),
  );
  if (error) throw error;

  return supabase.storage.from(BUSINESS_CARDS_BUCKET).getPublicUrl(path).data.publicUrl;
}
