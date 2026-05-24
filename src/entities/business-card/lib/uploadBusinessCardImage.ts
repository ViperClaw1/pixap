import type { ImagePickerAsset } from "expo-image-picker";
import { supabase } from "@/shared/api/supabase/client";
import {
  BUSINESS_CARD_GALLERY_MAX_LONG_EDGE,
  BUSINESS_CARD_HERO_MAX_LONG_EDGE,
  BUSINESS_CARD_THUMB_MAX_LONG_EDGE,
  POST_STORAGE_MAX_LONG_EDGE,
  prepareImageForStorageUpload,
} from "@/shared/lib/prepareImageForStorageUpload";
import { buildStorageUploadOptions } from "@/shared/lib/storageUploadOptions";
import {
  BUSINESS_CARD_GALLERY_FILE,
  BUSINESS_CARD_HERO_FILE,
  BUSINESS_CARD_THUMB_FILE,
} from "@/shared/lib/business-card/businessCardPregenStorage";

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

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${userId}/venue-${stamp}.${fileExtension}`;
  const { error } = await supabase.storage.from(BUSINESS_CARDS_BUCKET).upload(
    path,
    bytes,
    buildStorageUploadOptions(contentType, "immutable"),
  );
  if (error) throw error;

  const pregenUploads: Array<{ file: string; maxLongEdge: number }> = [
    { file: BUSINESS_CARD_THUMB_FILE, maxLongEdge: BUSINESS_CARD_THUMB_MAX_LONG_EDGE },
    { file: BUSINESS_CARD_HERO_FILE, maxLongEdge: BUSINESS_CARD_HERO_MAX_LONG_EDGE },
    { file: BUSINESS_CARD_GALLERY_FILE, maxLongEdge: BUSINESS_CARD_GALLERY_MAX_LONG_EDGE },
  ];

  for (const { file, maxLongEdge } of pregenUploads) {
    const prepared = await prepareImageForStorageUpload(asset, {
      maxLongEdgePx: maxLongEdge,
      format: "webp",
    });
    const pregenPath = path.replace(/\.[^./]+$/i, file);
    const { error: pregenError } = await supabase.storage
      .from(BUSINESS_CARDS_BUCKET)
      .upload(pregenPath, prepared.bytes, buildStorageUploadOptions(prepared.contentType, "immutable"));
    if (pregenError) throw pregenError;
  }

  return supabase.storage.from(BUSINESS_CARDS_BUCKET).getPublicUrl(path).data.publicUrl;
}
