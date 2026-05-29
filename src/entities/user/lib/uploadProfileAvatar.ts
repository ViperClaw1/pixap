import type { ImagePickerAsset } from "expo-image-picker";
import { supabase } from "@/shared/api/supabase/client";
import { AVATAR_THUMB_FILE, AVATAR_THUMB_PREGEN_LONG_EDGE } from "@/shared/lib/avatar/avatarPregenStorage";
import { encodeBlurHashFromPickerAssetUri } from "@/shared/lib/encodeMediaBlurHash";
import {
  AVATAR_STORAGE_MAX_LONG_EDGE,
  prepareImageForStorageUpload,
} from "@/shared/lib/prepareImageForStorageUpload";
import { buildStorageUploadOptions } from "@/shared/lib/storageUploadOptions";
import { devWarn } from "@/shared/lib/devLog";

const AVATARS_BUCKET = "avatars";

export type ProfileAvatarUploadResult = {
  avatarUrl: string;
  blurhash: string | null;
};

async function uploadAvatarThumbPregen(asset: ImagePickerAsset, primaryPath: string): Promise<void> {
  try {
    const prepared = await prepareImageForStorageUpload(asset, {
      maxLongEdgePx: AVATAR_THUMB_PREGEN_LONG_EDGE,
      format: "webp",
    });
    if (!prepared.bytes.byteLength) return;
    const pregenPath = primaryPath.replace(/\.[^./]+$/i, AVATAR_THUMB_FILE);
    const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(
      pregenPath,
      prepared.bytes,
      buildStorageUploadOptions(prepared.contentType, "immutable"),
    );
    if (error) {
      devWarn("[uploadProfileAvatar] thumb pregen failed", error.message);
    }
  } catch (e) {
    devWarn("[uploadProfileAvatar] thumb pregen failed", e);
  }
}

export async function uploadProfileAvatarAsset(
  userId: string,
  asset: ImagePickerAsset,
): Promise<ProfileAvatarUploadResult> {
  const blurhash = await encodeBlurHashFromPickerAssetUri(asset.uri);
  const { bytes, contentType, fileExtension } = await prepareImageForStorageUpload(asset, {
    maxLongEdgePx: AVATAR_STORAGE_MAX_LONG_EDGE,
  });
  if (!bytes.byteLength) {
    throw new Error("Selected image is empty (0 bytes).");
  }

  const path = `${userId}/${Date.now()}.${fileExtension}`;
  const { error: uploadError } = await supabase.storage.from(AVATARS_BUCKET).upload(
    path,
    bytes,
    buildStorageUploadOptions(contentType, "immutable"),
  );
  if (uploadError) throw uploadError;

  await uploadAvatarThumbPregen(asset, path);

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  return { avatarUrl: data.publicUrl, blurhash };
}
