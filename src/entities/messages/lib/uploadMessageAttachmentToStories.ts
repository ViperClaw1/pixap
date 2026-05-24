import type { ImagePickerAsset } from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as VideoThumbnails from "expo-video-thumbnails";
import { supabase } from "@/shared/api/supabase/client";
import { bytesFromBase64 } from "@/shared/lib/bytesFromBase64";
import { encodeBlurHashFromPickerAssetUri } from "@/shared/lib/encodeMediaBlurHash";
import { POST_FEED_FILE } from "@/shared/lib/feed/feedMediaPregenStorage";
import { messageVideoPosterStoragePath } from "@/entities/messages/lib/messageVideoPoster";
import {
  POST_FEED_PREGEN_MAX_LONG_EDGE,
  POST_STORAGE_MAX_LONG_EDGE,
  prepareImageForStorageUpload,
} from "@/shared/lib/prepareImageForStorageUpload";
import { buildStorageUploadOptions } from "@/shared/lib/storageUploadOptions";

const STORIES_BUCKET = "stories";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|avif)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)(\?|#|$)/i;
const MESSAGE_VIDEO_POSTER_MAX_EDGE = 480;

export type MessageAttachmentUploadResult = {
  publicUrl: string;
  blurhash: string | null;
};

function looksLikeRasterImage(uri: string, mime?: string | null): boolean {
  const m = mime?.trim().toLowerCase();
  if (m?.startsWith("image/")) return true;
  const path = uri.split("?")[0]?.split("#")[0] ?? uri;
  return IMAGE_EXT.test(path);
}

function isRemoteHttpUrl(uri: string): boolean {
  const lower = uri.trim().toLowerCase();
  return lower.startsWith("https://") || lower.startsWith("http://");
}

function extFromMime(mime: string | null | undefined): string | null {
  const m = mime?.trim().toLowerCase();
  if (!m) return null;
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "image/heic" || m === "image/heif") return "heic";
  if (m === "video/mp4") return "mp4";
  if (m === "video/quicktime") return "mov";
  if (m === "application/pdf") return "pdf";
  const semi = m.indexOf("/");
  if (semi > 0) return m.slice(semi + 1).replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  return null;
}

function extFromNameOrUri(name: string | null | undefined, uri: string): string {
  const fromName = name?.trim().match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  const path = uri.split("?")[0]?.split("#")[0] ?? uri;
  const fromPath = path.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  if (fromPath) return fromPath;
  return "bin";
}

function contentTypeForExt(ext: string): string {
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "heic":
      return "image/heic";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

function looksLikeVideo(uri: string, mime?: string | null): boolean {
  const m = mime?.trim().toLowerCase();
  if (m?.startsWith("video/")) return true;
  const path = uri.split("?")[0]?.split("#")[0] ?? uri;
  return VIDEO_EXT.test(path);
}

async function uploadMessageFeedPregen(asset: ImagePickerAsset, primaryPath: string): Promise<void> {
  try {
    const prepared = await prepareImageForStorageUpload(asset, {
      maxLongEdgePx: POST_FEED_PREGEN_MAX_LONG_EDGE,
      format: "webp",
    });
    if (!prepared.bytes.byteLength) return;
    const pregenPath = primaryPath.replace(/\.[^./]+$/i, POST_FEED_FILE);
    const { error } = await supabase.storage.from(STORIES_BUCKET).upload(
      pregenPath,
      prepared.bytes,
      buildStorageUploadOptions(prepared.contentType, "immutable"),
    );
    if (error) {
      console.warn("[uploadMessageAttachment] feed pregen upload failed", error.message);
    }
  } catch (e) {
    console.warn("[uploadMessageAttachment] feed pregen failed", e);
  }
}

async function uploadVideoPosterFromLocalUri(
  localVideoUri: string,
  videoStoragePath: string,
): Promise<string | null> {
  try {
    const thumb = await VideoThumbnails.getThumbnailAsync(localVideoUri, { time: 400, quality: 0.72 });
    const blurhash = await encodeBlurHashFromPickerAssetUri(thumb.uri);
    const asset = { uri: thumb.uri, width: 0, height: 0 } as ImagePickerAsset;
    const { bytes, contentType, fileExtension } = await prepareImageForStorageUpload(asset, {
      maxLongEdgePx: MESSAGE_VIDEO_POSTER_MAX_EDGE,
      format: "webp",
    });
    if (!bytes.byteLength) return blurhash;
    const posterPath = messageVideoPosterStoragePath(videoStoragePath, fileExtension);
    const { error } = await supabase.storage.from(STORIES_BUCKET).upload(
      posterPath,
      bytes,
      buildStorageUploadOptions(contentType, "immutable"),
    );
    if (error) {
      console.warn("[uploadMessageAttachment] poster upload failed", error.message);
    }
    return blurhash;
  } catch (e) {
    console.warn("[uploadMessageAttachment] poster generation failed", e);
    return null;
  }
}

async function readLocalUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    const res = await fetch(uri);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength) return buf;
    }
  } catch {
    /* fall through */
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  const raw = bytesFromBase64(base64);
  return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
}

/**
 * Chat attachments are stored as public URLs. Local picker URIs must be uploaded under the user's
 * `stories` bucket prefix (RLS: first path segment === auth uid).
 */
export async function uploadMessageAttachmentIfLocal(
  userId: string,
  uri: string,
  meta?: { mimeType?: string | null; name?: string | null },
): Promise<MessageAttachmentUploadResult> {
  const trimmed = uri.trim();
  if (!trimmed) throw new Error("Empty attachment URI");
  if (isRemoteHttpUrl(trimmed)) {
    return { publicUrl: trimmed, blurhash: null };
  }

  const mime = meta?.mimeType?.trim() || null;
  const name = meta?.name?.trim() || null;
  const treatAsImage = looksLikeRasterImage(trimmed, mime);

  if (treatAsImage) {
    try {
      const asset = { uri: trimmed, width: 0, height: 0 } as ImagePickerAsset;
      const blurhash = await encodeBlurHashFromPickerAssetUri(trimmed);
      const { bytes, contentType, fileExtension } = await prepareImageForStorageUpload(asset, {
        maxLongEdgePx: POST_STORAGE_MAX_LONG_EDGE,
      });
      const path = `${userId}/msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExtension}`;
      const { error } = await supabase.storage.from(STORIES_BUCKET).upload(
        path,
        bytes,
        buildStorageUploadOptions(contentType, "immutable"),
      );
      if (error) throw error;
      await uploadMessageFeedPregen(asset, path);
      return {
        publicUrl: supabase.storage.from(STORIES_BUCKET).getPublicUrl(path).data.publicUrl,
        blurhash,
      };
    } catch {
      /* fall through to raw upload */
    }
  }

  const extGuess = extFromMime(mime) ?? extFromNameOrUri(name, trimmed);
  const contentType = mime && mime.includes("/") ? mime : contentTypeForExt(extGuess);
  const bytes = await readLocalUriAsArrayBuffer(trimmed);
  if (!bytes.byteLength) throw new Error("Attachment file is empty");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${userId}/msg-${suffix}.${extGuess}`;
  const { error } = await supabase.storage.from(STORIES_BUCKET).upload(
    path,
    bytes,
    buildStorageUploadOptions(contentType, "immutable"),
  );
  if (error) throw error;

  let blurhash: string | null = null;
  if (looksLikeVideo(trimmed, mime)) {
    blurhash = await uploadVideoPosterFromLocalUri(trimmed, path);
  }

  return {
    publicUrl: supabase.storage.from(STORIES_BUCKET).getPublicUrl(path).data.publicUrl,
    blurhash,
  };
}
