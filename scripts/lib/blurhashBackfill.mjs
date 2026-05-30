import { encode } from "blurhash";

export const BLUR_SAMPLE_SIZE = 32;
export const DOWNLOAD_TIMEOUT_MS = 30_000;

const STORIES_OBJECT_PUBLIC = "/storage/v1/object/public/stories/";
const POST_FEED_FILE = "_feed.webp";
const STORY_DISPLAY_FILE = "_story.webp";

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)(\?|#|$)/i;

const MISSING_COLUMN_RE = /media_blurhashes.*does not exist|column.*media_blurhashes/i;

export function isMissingMediaBlurhashesColumnError(message) {
  return MISSING_COLUMN_RE.test(String(message ?? ""));
}

/**
 * Ensures posts/stories.media_blurhashes exist (via RPC or helpful error).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function ensureFeedMediaBlurhashColumns(supabase) {
  const { error } = await supabase.rpc("ensure_feed_media_blurhash_columns");
  if (!error) return;

  const msg = error.message ?? String(error);
  if (/could not find the function|schema cache/i.test(msg)) {
    throw new Error(
      "posts.media_blurhashes / stories.media_blurhashes are missing and ensure_feed_media_blurhash_columns() is not deployed. " +
        "Run: supabase db push (migrations 20260514_posts_stories_media_blurhashes.sql and 20260630130000_ensure_feed_media_blurhash_columns_rpc.sql).",
    );
  }
  throw new Error(`ensure_feed_media_blurhash_columns: ${msg}`);
}

export function parseArgs(argv, { defaultLimit = 200 } = {}) {
  const args = argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limitRaw = limitIdx >= 0 ? args[limitIdx + 1] : null;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : defaultLimit;
  return {
    dryRun: args.includes("--dry-run"),
    postsOnly: args.includes("--posts-only"),
    storiesOnly: args.includes("--stories-only"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : defaultLimit,
  };
}

/** Parses `media_url`: JSON array of URLs or a single URL string. */
export function parseMediaUrls(raw) {
  const value = raw?.trim();
  if (!value) return [];
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => typeof item === "string" && item.trim().length > 0)
          .map((s) => s.trim());
      }
    } catch {
      return [];
    }
  }
  return [value];
}

export function isRasterImageUrl(url) {
  const path = String(url ?? "")
    .split("?")[0]
    ?.split("#")[0] ?? "";
  if (VIDEO_EXT.test(path)) return false;
  return /\.(jpe?g|png|gif|webp|bmp|heic|avif)(\?|#|$)/i.test(path) || path.includes("/object/public/");
}

function storiesObjectPath(pathOrUrl) {
  const trimmed = String(pathOrUrl ?? "").trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const idx = lower.indexOf(STORIES_OBJECT_PUBLIC);
  if (idx >= 0) {
    const rest = trimmed.slice(idx + STORIES_OBJECT_PUBLIC.length).split("?")[0]?.split("#")[0] ?? "";
    return rest.replace(/^\/+/, "") || null;
  }
  if (/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/^\/+/, "") || null;
}

function pregenPublicUrl(pathOrUrl, pregenFile) {
  const objectPath = storiesObjectPath(pathOrUrl);
  if (!objectPath || objectPath.endsWith(pregenFile)) return null;
  const base = objectPath.replace(/\.[^./]+$/, "");
  if (!base || base === objectPath) return null;
  const pregenPath = `${base}${pregenFile}`;
  const trimmed = String(pathOrUrl ?? "").trim();
  const lower = trimmed.toLowerCase();
  const idx = lower.indexOf(STORIES_OBJECT_PUBLIC);
  if (idx >= 0) {
    return `${trimmed.slice(0, idx + STORIES_OBJECT_PUBLIC.length)}${pregenPath}`;
  }
  return null;
}

export function publicStoriesMediaUrl(supabaseUrl, pathOrUrl) {
  const trimmed = String(pathOrUrl ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/stories/${trimmed.replace(/^\/+/, "")}`;
}

/** Prefer smaller pregen WebP when present (posts: feed, stories: story display). */
export function preferredDownloadUrl(publicUrl, { kind }) {
  if (!publicUrl || !isRasterImageUrl(publicUrl)) return null;
  const feed = pregenPublicUrl(publicUrl, POST_FEED_FILE);
  const story = pregenPublicUrl(publicUrl, STORY_DISPLAY_FILE);
  if (kind === "post") return feed ?? publicUrl;
  return story ?? feed ?? publicUrl;
}

export function parseExistingBlurhashes(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => (typeof x === "string" && x.trim().length > 0 ? x.trim() : null));
}

export function needsBlurhashBackfill(urls, existing) {
  if (!urls.length) return false;
  const rasterIndexes = urls
    .map((url, i) => (isRasterImageUrl(url) ? i : -1))
    .filter((i) => i >= 0);
  if (!rasterIndexes.length) return false;
  return rasterIndexes.some((i) => !existing[i]);
}

export async function fetchImageRgb(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(buf)
      .resize(BLUR_SAMPLE_SIZE, BLUR_SAMPLE_SIZE, { fit: "cover" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = info.channels ?? 4;
    if (channels !== 4) {
      throw new Error(`expected RGBA from sharp, got ${channels} channel(s)`);
    }
    const expected = info.width * info.height * 4;
    if (data.length !== expected) {
      throw new Error(`pixel buffer length ${data.length} !== ${expected}`);
    }
    const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
    return { pixels, width: info.width, height: info.height };
  } finally {
    clearTimeout(timer);
  }
}

export async function encodeBlurhashFromUrl(downloadUrl) {
  const { pixels, width, height } = await fetchImageRgb(downloadUrl);
  return encode(pixels, width, height, 4, 3);
}
