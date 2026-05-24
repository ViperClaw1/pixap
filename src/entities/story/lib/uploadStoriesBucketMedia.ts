import type { ImagePickerAsset } from "expo-image-picker";
import { supabase } from "@/shared/api/supabase/client";
import {
  POST_FEED_PREGEN_MAX_LONG_EDGE,
  POST_STORAGE_MAX_LONG_EDGE,
  STORY_DISPLAY_PREGEN_MAX_LONG_EDGE,
  STORY_STORAGE_MAX_LONG_EDGE,
  prepareImageForStorageUpload,
} from "@/shared/lib/prepareImageForStorageUpload";
import { buildStorageUploadOptions } from "@/shared/lib/storageUploadOptions";
import { POST_FEED_FILE, STORY_DISPLAY_FILE } from "@/shared/lib/feed/feedMediaPregenStorage";

export const STORIES_BUCKET = "stories";

export type StoriesBucketPathBuilder = (ctx: {
  userId: string;
  index: number;
  fileExtension: string;
}) => string;

type PregenUploadSpec = { file: string; maxLongEdgePx: number };

async function uploadPregenVariant(
  asset: ImagePickerAsset,
  primaryPath: string,
  spec: PregenUploadSpec,
): Promise<void> {
  const prepared = await prepareImageForStorageUpload(asset, {
    maxLongEdgePx: spec.maxLongEdgePx,
    format: "webp",
  });
  const pregenPath = primaryPath.replace(/\.[^./]+$/i, spec.file);
  const { error } = await supabase.storage
    .from(STORIES_BUCKET)
    .upload(pregenPath, prepared.bytes, buildStorageUploadOptions(prepared.contentType, "immutable"));
  if (error) throw error;
}

export async function uploadPickerAssetsToStoriesBucket(
  assets: ImagePickerAsset[],
  userId: string | undefined,
  buildPath: StoriesBucketPathBuilder,
  maxLongEdgePx: number = STORY_STORAGE_MAX_LONG_EDGE,
  pregenSpecs: PregenUploadSpec[] = [],
): Promise<string[]> {
  const ownerId = userId ?? "anonymous";
  const uploadedUrls: string[] = [];

  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    const { bytes, contentType, fileExtension } = await prepareImageForStorageUpload(asset, { maxLongEdgePx });
    if (!bytes.byteLength) {
      throw new Error("Selected image is empty. Please try another image.");
    }
    const path = buildPath({ userId: ownerId, index, fileExtension });
    const { error: uploadError } = await supabase.storage.from(STORIES_BUCKET).upload(
      path,
      bytes,
      buildStorageUploadOptions(contentType, "immutable"),
    );
    if (uploadError) throw uploadError;

    for (const spec of pregenSpecs) {
      await uploadPregenVariant(asset, path, spec);
    }

    const { data } = supabase.storage.from(STORIES_BUCKET).getPublicUrl(path);
    uploadedUrls.push(data.publicUrl);
  }

  return uploadedUrls;
}

export function defaultStoryPathBuilder(ctx: { userId: string; index: number; fileExtension: string }): string {
  return `${ctx.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ctx.fileExtension}`;
}

export function postMediaPathBuilder(ctx: { userId: string; index: number; fileExtension: string }): string {
  return `${ctx.userId}/post-${Date.now()}-${ctx.index}.${ctx.fileExtension}`;
}

export function profileStoryPathBuilder(ctx: { userId: string; index: number; fileExtension: string }): string {
  return `${ctx.userId}/story-${Date.now()}-${ctx.index}.${ctx.fileExtension}`;
}

export async function uploadPostPickerAssets(
  assets: ImagePickerAsset[],
  userId: string | undefined,
): Promise<string[]> {
  return uploadPickerAssetsToStoriesBucket(assets, userId, postMediaPathBuilder, POST_STORAGE_MAX_LONG_EDGE, [
    { file: POST_FEED_FILE, maxLongEdgePx: POST_FEED_PREGEN_MAX_LONG_EDGE },
  ]);
}

export async function uploadStoryPickerAssets(
  assets: ImagePickerAsset[],
  userId: string | undefined,
  buildPath: StoriesBucketPathBuilder = defaultStoryPathBuilder,
): Promise<string[]> {
  return uploadPickerAssetsToStoriesBucket(assets, userId, buildPath, STORY_STORAGE_MAX_LONG_EDGE, [
    { file: STORY_DISPLAY_FILE, maxLongEdgePx: STORY_DISPLAY_PREGEN_MAX_LONG_EDGE },
  ]);
}
