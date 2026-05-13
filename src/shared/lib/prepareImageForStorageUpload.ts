import { manipulateAsync, SaveFormat, type ImageResult } from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";
import { bytesFromBase64 } from "@/shared/lib/bytesFromBase64";

/** Long edge for post photos (feed carousel / zoom); balance size vs quality. */
export const POST_STORAGE_MAX_LONG_EDGE = 1600;

/** Long edge for ephemeral story media (fullscreen phone). */
export const STORY_STORAGE_MAX_LONG_EDGE = 1024;

/** Long edge for profile avatars (small on screen; enough for 2–3x DPR). */
export const AVATAR_STORAGE_MAX_LONG_EDGE = 768;

/** Default lossy quality for WebP/JPEG before Storage upload (0–1). */
export const STORAGE_IMAGE_QUALITY = 0.73;

export type StorageImageFormat = "webp" | "jpeg";

export type PrepareImageForStorageOptions = {
  maxLongEdgePx: number;
  /** 0–1, default STORAGE_IMAGE_QUALITY */
  imageQuality?: number;
  /** Default `webp` (smaller); use `jpeg` only if compatibility requires it. */
  format?: StorageImageFormat;
};

function uint8ArrayToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function resolveEncodeOptions(options: PrepareImageForStorageOptions): {
  saveFormat: SaveFormat;
  compress: number;
  contentType: string;
  fileExtension: string;
} {
  const format: StorageImageFormat = options.format ?? "webp";
  const compress = options.imageQuality ?? STORAGE_IMAGE_QUALITY;
  if (format === "jpeg") {
    return {
      saveFormat: SaveFormat.JPEG,
      compress,
      contentType: "image/jpeg",
      fileExtension: "jpg",
    };
  }
  return {
    saveFormat: SaveFormat.WEBP,
    compress,
    contentType: "image/webp",
    fileExtension: "webp",
  };
}

/**
 * Downscale (by long edge) and re-encode (WebP by default) before Supabase Storage upload.
 * Uses manipulator `base64` output so we never rely on `fetch(file://...)` (fragile on some Android builds).
 */
export async function prepareImageForStorageUpload(
  asset: ImagePickerAsset,
  options: PrepareImageForStorageOptions,
): Promise<{ bytes: ArrayBuffer; contentType: string; fileExtension: string }> {
  const { maxLongEdgePx } = options;
  const { saveFormat, compress, contentType, fileExtension } = resolveEncodeOptions(options);
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;
  const actions: { resize: { width?: number; height?: number } }[] = [];
  if (w > 0 && h > 0) {
    const longEdge = Math.max(w, h);
    if (longEdge > maxLongEdgePx) {
      if (w >= h) {
        actions.push({ resize: { width: maxLongEdgePx } });
      } else {
        actions.push({ resize: { height: maxLongEdgePx } });
      }
    }
  }

  let result: ImageResult;
  try {
    result = await manipulateAsync(asset.uri, actions, {
      compress,
      format: saveFormat,
      base64: true,
    });
  } catch (e) {
    const inner = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not process image: ${inner}`, { cause: e });
  }

  if (result.base64) {
    const raw = bytesFromBase64(result.base64);
    if (!raw.byteLength) {
      throw new Error("Compressed image is empty. Try another photo.");
    }
    return {
      bytes: uint8ArrayToArrayBuffer(raw),
      contentType,
      fileExtension,
    };
  }

  const response = await fetch(result.uri);
  if (!response.ok) {
    throw new Error(`Failed to read compressed image (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength) {
    throw new Error("Compressed image is empty. Try another photo.");
  }
  return { bytes: buffer, contentType, fileExtension };
}
