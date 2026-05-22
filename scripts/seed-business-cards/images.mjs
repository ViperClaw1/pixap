import { fetchPlacePhotoBytes } from "./googleMaps.mjs";
import {
  BUSINESS_CARDS_BUCKET,
  PHOTO_POOLS,
  PICSUM_IDS,
  SEED_STORAGE_PREFIX,
  STORAGE_CACHE_CONTROL,
  log,
  picsumIdDownloadUrl,
  picsumSeedDownloadUrl,
  sleep,
  unsplashDownloadUrl,
} from "./lib.mjs";

const UPLOAD_DELAY_MS = 120;
const DOWNLOAD_TIMEOUT_MS = 45_000;
const MIN_IMAGE_COUNT = 3;

export class GoogleVenueImagesError extends Error {
  /**
   * @param {string} venueSlug
   * @param {string} reason Short human-readable cause (logged as [skip])
   * @param {string} [details]
   */
  constructor(venueSlug, reason, details = "") {
    const msg = details ? `${reason} — ${details}` : reason;
    super(msg);
    this.name = "GoogleVenueImagesError";
    this.venueSlug = venueSlug;
    this.reason = reason;
    this.details = details;
  }
}

async function fetchImageBytes(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 8_000) throw new Error(`too small (${buf.byteLength} bytes)`);
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return { bytes: buf, contentType: contentType.split(";")[0].trim() || "image/jpeg" };
  } finally {
    clearTimeout(timer);
  }
}

async function downloadFromCandidates(label, candidates) {
  const failures = [];
  for (let c = 0; c < candidates.length; c += 1) {
    const { url, kind } = candidates[c];
    try {
      const payload = await fetchImageBytes(url);
      if (c > 0) log("images", `${label}: OK via ${kind}`);
      return payload;
    } catch (err) {
      failures.push(`${kind}: ${err.message}`);
    }
  }
  throw new Error(`${label} — all sources failed (${failures.join("; ")})`);
}

function extensionForContentType(contentType) {
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("png")) return "png";
  return "jpg";
}

function buildStockCandidateUrls(venue, imageIndex) {
  const pool = PHOTO_POOLS[venue.photoPool] ?? PHOTO_POOLS.restaurant;
  const poolIdx = (venue.seedOffset + imageIndex) % pool.length;
  const picsumBase = (venue.seedOffset * 3 + imageIndex) % PICSUM_IDS.length;

  const candidates = [
    { kind: "unsplash", url: unsplashDownloadUrl(pool[poolIdx]) },
    {
      kind: "picsum-seed",
      url: picsumSeedDownloadUrl(`pixap-${venue.slug}-${imageIndex + 1}`),
    },
  ];

  for (let offset = 0; offset < Math.min(4, PICSUM_IDS.length); offset += 1) {
    const id = PICSUM_IDS[(picsumBase + offset) % PICSUM_IDS.length];
    candidates.push({ kind: `picsum-id-${id}`, url: picsumIdDownloadUrl(id) });
  }

  return candidates;
}

async function uploadOneImage(supabase, venue, imageIndex, payload) {
  const ext = extensionForContentType(payload.contentType);
  const path = `${SEED_STORAGE_PREFIX}/${venue.slug}/${String(imageIndex + 1).padStart(2, "0")}.${ext}`;

  const { error } = await supabase.storage.from(BUSINESS_CARDS_BUCKET).upload(path, payload.bytes, {
    contentType: payload.contentType,
    cacheControl: STORAGE_CACHE_CONTROL,
    upsert: true,
  });
  if (error) throw new Error(`storage upload ${path}: ${error.message}`);

  const { data } = supabase.storage.from(BUSINESS_CARDS_BUCKET).getPublicUrl(path);
  log("images", `Uploaded ${path} (${Math.round(payload.bytes.byteLength / 1024)} KB)`);
  return data.publicUrl;
}

/**
 * Google Places photos only — no Unsplash/Picsum fallback.
 * @throws {GoogleVenueImagesError}
 */
async function uploadVenueImagesFromGoogleOnly(
  supabase,
  venue,
  imageCount,
  googleApiKey,
  googlePhotoMaxBytes,
) {
  const refs = [...new Set(venue._googlePlace?.photoReferences ?? [])];

  if (!refs.length) {
    throw new GoogleVenueImagesError(
      venue.slug,
      "Google POI has no photo references",
      venue._googlePlace?.name ? `place "${venue._googlePlace.name}"` : undefined,
    );
  }

  if (refs.length < imageCount) {
    throw new GoogleVenueImagesError(
      venue.slug,
      `Not enough Google photo references for this venue`,
      `need ${imageCount}, place "${venue._googlePlace?.name ?? "?"}" has ${refs.length}`,
    );
  }

  const capLabel =
    googlePhotoMaxBytes != null ? `${Math.round(googlePhotoMaxBytes / 1024)} KB` : "no cap";
  const urls = [];
  const failures = [];

  for (let r = 0; r < refs.length && urls.length < imageCount; r += 1) {
    const ref = refs[r];
    const label = `${venue.slug} #${urls.length + 1}`;
    const refHint = `ref …${ref.slice(-10)}`;

    try {
      const payload = await fetchPlacePhotoBytes(ref, googleApiKey, { maxBytes: googlePhotoMaxBytes });
      const publicUrl = await uploadOneImage(supabase, venue, urls.length, payload);
      urls.push(publicUrl);
      log("images", `${label}: Google Places (${refHint}, ${Math.round(payload.bytes.byteLength / 1024)} KB)`);
      if (urls.length < imageCount) await sleep(UPLOAD_DELAY_MS);
    } catch (err) {
      failures.push(`${refHint}: ${err.message}`);
      log("images", `${label}: Google photo rejected (${err.message})`);
    }
  }

  if (urls.length < imageCount) {
    throw new GoogleVenueImagesError(
      venue.slug,
      `Could not collect ${imageCount} Google photos within --google-photo-max-kb=${capLabel}`,
      failures.length ? failures.join("; ") : "no photo reference succeeded",
    );
  }

  return urls;
}

async function uploadVenueImagesFromStock(supabase, venue, imageCount) {
  const urls = [];

  for (let i = 0; i < imageCount; i += 1) {
    const label = `${venue.slug} #${i + 1}`;
    const candidates = buildStockCandidateUrls(venue, i);
    const payload = await downloadFromCandidates(label, candidates);
    urls.push(await uploadOneImage(supabase, venue, i, payload));
    if (i < imageCount - 1) await sleep(UPLOAD_DELAY_MS);
  }

  return urls;
}

/**
 * Download images and upload to `business-cards` bucket.
 * When `requireGooglePhotos` is true, only Google Places API is used (no stock fallback).
 * @returns {Promise<string[]>} public URLs in display order
 */
export async function uploadVenueImages(
  supabase,
  venue,
  imageCount,
  { googleApiKey = null, googlePhotoMaxBytes = null, requireGooglePhotos = false } = {},
) {
  if (imageCount < MIN_IMAGE_COUNT) {
    throw new GoogleVenueImagesError(
      venue.slug,
      `Invalid image count ${imageCount}`,
      `minimum is ${MIN_IMAGE_COUNT}`,
    );
  }

  if (requireGooglePhotos) {
    if (!googleApiKey) {
      throw new GoogleVenueImagesError(
        venue.slug,
        "Google API key required for photos",
        "set EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY or use --no-google with stock images",
      );
    }
    if (!venue._googlePlace) {
      throw new GoogleVenueImagesError(
        venue.slug,
        "No Google Places POI matched",
        "Places search returned no suitable venue with photos near seed coordinates",
      );
    }
    return uploadVenueImagesFromGoogleOnly(
      supabase,
      venue,
      imageCount,
      googleApiKey,
      googlePhotoMaxBytes,
    );
  }

  if (googleApiKey && venue._googlePlace?.photoReferences?.length) {
    try {
      return await uploadVenueImagesFromGoogleOnly(
        supabase,
        venue,
        imageCount,
        googleApiKey,
        googlePhotoMaxBytes,
      );
    } catch (err) {
      if (err instanceof GoogleVenueImagesError) throw err;
      throw new GoogleVenueImagesError(venue.slug, "Google Places photo pipeline failed", err.message);
    }
  }

  log(
    "images",
    `${venue.slug}: stock/Unsplash/Picsum (--no-google or no matched POI / no API key)`,
  );
  return uploadVenueImagesFromStock(supabase, venue, imageCount);
}
