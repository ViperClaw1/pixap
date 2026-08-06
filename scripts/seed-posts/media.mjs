import { encode } from "blurhash";
import {
  POSTS_BUCKET,
  STORAGE_CACHE_CONTROL,
  log,
  toNodeBuffer,
  withRetry,
} from "./lib.mjs";

const DOWNLOAD_TIMEOUT_MS = 30_000;
const POST_LONG_EDGE = 1600;
const FEED_LONG_EDGE = 720;

async function downloadImage(url) {
  return withRetry(`download:${url.slice(0, 64)}`, async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 8_000) throw new Error(`image is too small (${bytes.length} bytes)`);
      return bytes;
    } finally {
      clearTimeout(timer);
    }
  });
}

async function prepareImage(sourceBytes) {
  const sharp = (await import("sharp")).default;
  const original = await sharp(sourceBytes)
    .rotate()
    .resize(POST_LONG_EDGE, POST_LONG_EDGE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 73 })
    .toBuffer();
  const feed = await sharp(sourceBytes)
    .rotate()
    .resize(FEED_LONG_EDGE, FEED_LONG_EDGE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
  const { data, info } = await sharp(feed)
    .resize(32, 32, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);

  return {
    original: toNodeBuffer(original),
    feed: toNodeBuffer(feed),
    blurhash: encode(pixels, info.width, info.height, 4, 3),
  };
}

async function uploadObject(supabase, path, bytes) {
  await withRetry(`storage:${path}`, async () => {
    const { error } = await supabase.storage.from(POSTS_BUCKET).upload(path, bytes, {
      contentType: "image/webp",
      cacheControl: STORAGE_CACHE_CONTROL,
      upsert: false,
    });
    if (error) throw new Error(error.message);
  });
}

export async function removeUploadedPostMedia(supabase, paths) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(POSTS_BUCKET).remove(paths);
  if (error) log("cleanup", `Could not remove ${paths.length} object(s): ${error.message}`);
}

export async function uploadPostMedia(supabase, { userId, postToken, sourceUrls, imageCount }) {
  const publicUrls = [];
  const blurhashes = [];
  const uploadedPaths = [];
  const failures = [];

  for (let sourceIndex = 0; sourceIndex < sourceUrls.length; sourceIndex += 1) {
    if (publicUrls.length >= imageCount) break;
    const sourceUrl = sourceUrls[sourceIndex];
    const ordinal = String(sourceIndex + 1).padStart(2, "0");
    const basePath = `${userId}/seed-posts/${postToken}/${ordinal}`;
    const originalPath = `${basePath}.webp`;
    const feedPath = `${basePath}_feed.webp`;
    const sourcePaths = [];

    try {
      const prepared = await prepareImage(await downloadImage(sourceUrl));
      await uploadObject(supabase, originalPath, prepared.original);
      uploadedPaths.push(originalPath);
      sourcePaths.push(originalPath);
      await uploadObject(supabase, feedPath, prepared.feed);
      uploadedPaths.push(feedPath);
      sourcePaths.push(feedPath);

      const publicUrl = supabase.storage.from(POSTS_BUCKET).getPublicUrl(originalPath).data.publicUrl;
      publicUrls.push(publicUrl);
      blurhashes.push(prepared.blurhash);
      log("media", `Uploaded ${originalPath} + feed pregen`);
    } catch (error) {
      await removeUploadedPostMedia(supabase, sourcePaths);
      for (const path of sourcePaths) {
        const pathIndex = uploadedPaths.indexOf(path);
        if (pathIndex >= 0) uploadedPaths.splice(pathIndex, 1);
      }
      failures.push(error instanceof Error ? error.message : String(error));
      log("media", `Skipped source ${sourceUrl.slice(0, 72)}: ${failures.at(-1)}`);
    }
  }

  if (!publicUrls.length) {
    await removeUploadedPostMedia(supabase, uploadedPaths);
    throw new Error(`No business-card image could be copied (${failures.slice(0, 3).join("; ")})`);
  }

  return { publicUrls, blurhashes, uploadedPaths };
}
