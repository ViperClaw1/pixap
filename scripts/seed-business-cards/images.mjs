import { fetchPlacePhotoBytes } from "./googleMaps.mjs";
import {
  createSeedImageRegistry,
  checkImageUnique,
  registerUploadedImage,
} from "./seedImageRegistry.mjs";
import {
  BUSINESS_CARDS_BUCKET,
  PHOTO_POOLS,
  PICSUM_IDS,
  SEED_IMAGES_MIN,
  SEED_STORAGE_PREFIX,
  STORAGE_CACHE_CONTROL,
  log,
  picsumIdDownloadUrl,
  picsumSeedDownloadUrl,
  sleep,
  unsplashDownloadUrl,
  toNodeBuffer,
  withRetry,
} from "./lib.mjs";
import { uploadBusinessCardAllPregens } from "./pregen.mjs";

const UPLOAD_DELAY_MS = 280;
const PHOTO_RETRY_COOLDOWN_MS = 900;
const DOWNLOAD_TIMEOUT_MS = 45_000;
const MIN_IMAGE_COUNT = SEED_IMAGES_MIN;

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

export { createSeedImageRegistry } from "./seedImageRegistry.mjs";

async function fetchImageBytes(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    return await withRetry(`download:${url.slice(0, 48)}`, async () => {
      const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 8_000) throw new Error(`too small (${buf.byteLength} bytes)`);
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      return {
        bytes: toNodeBuffer(buf),
        contentType: contentType.split(";")[0].trim() || "image/jpeg",
      };
    });
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

/** One folder per Google `place_id` — never reuse template slug paths across POIs. */
function googlePlaceStorageFolder(venue) {
  const placeId = venue._googlePlace?.placeId?.trim();
  if (!placeId) {
    throw new Error(`${venue.slug}: missing Google place_id — cannot upload venue photos`);
  }
  return `${SEED_STORAGE_PREFIX}/places/${placeId}`;
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

async function uploadOneImage(supabase, storageFolder, imageIndex, payload) {
  const ext = extensionForContentType(payload.contentType);
  const path = `${storageFolder}/${String(imageIndex + 1).padStart(2, "0")}.${ext}`;
  const body = toNodeBuffer(payload.bytes);

  await withRetry(`storage:${path}`, async () => {
    const { error } = await supabase.storage.from(BUSINESS_CARDS_BUCKET).upload(path, body, {
      contentType: payload.contentType,
      cacheControl: STORAGE_CACHE_CONTROL,
      upsert: true,
    });
    if (error) throw new Error(`storage upload ${path}: ${error.message}`);
  });

  const { data } = supabase.storage.from(BUSINESS_CARDS_BUCKET).getPublicUrl(path);
  log("images", `Uploaded ${path} (${Math.round(body.byteLength / 1024)} KB)`);
  try {
    const pregenUrls = await uploadBusinessCardAllPregens(supabase, path, body);
    const created = Object.keys(pregenUrls).filter((k) => pregenUrls[k]);
    if (created.length > 0) {
      log("images", `Uploaded pregen for ${path}: ${created.join(", ")}`);
    }
  } catch (err) {
    log("images", `pregen skip ${path}: ${err.message}`);
  }
  return data.publicUrl;
}

/**
 * Google Places photos only — no Unsplash/Picsum fallback.
 * Returns `[]` when fewer than `imageCount` unique photos could be collected.
 */
async function uploadVenueImagesFromGoogleOnly(
  supabase,
  venue,
  imageCount,
  googleApiKey,
  googlePhotoMaxBytes,
  registry,
) {
  const refs = [...new Set(venue._googlePlace?.photoReferences ?? [])];

  if (!refs.length) {
    log("images", `${venue.slug}: Google POI has no photo references — images[] will be empty`);
    return [];
  }

  const storageFolder = googlePlaceStorageFolder(venue);
  const urls = [];
  const failures = [];

  for (let r = 0; r < refs.length && urls.length < imageCount; r += 1) {
    const ref = refs[r];
    const label = `${venue.slug} #${urls.length + 1}`;
    const refHint = `ref …${ref.slice(-10)}`;

    if (registry.usedPhotoRefs.has(ref)) {
      log("images", `${label}: skip ${refHint} — already used for another venue`);
      continue;
    }

    try {
      const payload = await fetchPlacePhotoBytes(ref, googleApiKey, { maxBytes: googlePhotoMaxBytes });
      payload.bytes = toNodeBuffer(payload.bytes);
      const preUploadDup = checkImageUnique(registry, ref, payload.bytes);
      if (preUploadDup) {
        failures.push(`${refHint}: ${preUploadDup}`);
        log("images", `${label}: skip ${refHint} — ${preUploadDup}`);
        continue;
      }
      const publicUrl = await uploadOneImage(supabase, storageFolder, urls.length, payload);
      if (registry.usedPublicUrls.has(publicUrl)) {
        failures.push(`${refHint}: storage URL already in catalogue`);
        log("images", `${label}: skip ${refHint} — public URL already used`);
        continue;
      }
      registerUploadedImage(registry, ref, payload.bytes, publicUrl);
      urls.push(publicUrl);
      log(
        "images",
        `${label}: Google Places (${refHint}, ${Math.round(payload.bytes.length / 1024)} KB)`,
      );
      if (urls.length < imageCount) await sleep(UPLOAD_DELAY_MS);
    } catch (err) {
      failures.push(`${refHint}: ${err.message}`);
      log("images", `${label}: Google photo rejected (${err.message})`);
      if (urls.length === 0 && failures.length >= 2) {
        await sleep(PHOTO_RETRY_COOLDOWN_MS);
      }
    }
  }

  if (urls.length < imageCount) {
    const poiLabel = venue._googlePlace?.name?.trim() ?? venue.slug;
    log(
      "images",
      `${poiLabel}: only ${urls.length}/${imageCount} unique Google photo(s) — images[] will be empty (${failures.slice(0, 3).join("; ")})`,
    );
    return [];
  }

  return urls;
}

async function uploadVenueImagesFromStock(supabase, venue, imageCount) {
  const urls = [];
  const storageFolder = `${SEED_STORAGE_PREFIX}/${venue.slug}`;

  for (let i = 0; i < imageCount; i += 1) {
    const label = `${venue.slug} #${i + 1}`;
    const candidates = buildStockCandidateUrls(venue, i);
    const payload = await downloadFromCandidates(label, candidates);
    urls.push(await uploadOneImage(supabase, storageFolder, i, payload));
    if (i < imageCount - 1) await sleep(UPLOAD_DELAY_MS);
  }

  return urls;
}

/**
 * Download images and upload to `business-cards` bucket.
 * When `requireGooglePhotos` is true, only Google Places API is used (no stock fallback).
 * @returns {Promise<string[]>} public URLs in display order (empty when Google pipeline fails)
 */
export async function uploadVenueImages(
  supabase,
  venue,
  imageCount,
  { googleApiKey = null, googlePhotoMaxBytes = null, requireGooglePhotos = false, registry = null } = {},
) {
  if (imageCount < MIN_IMAGE_COUNT) {
    throw new GoogleVenueImagesError(
      venue.slug,
      `Invalid image count ${imageCount}`,
      `minimum is ${MIN_IMAGE_COUNT}`,
    );
  }

  const imageRegistry = registry ?? createSeedImageRegistry();

  if (requireGooglePhotos) {
    if (!googleApiKey) {
      log("images", `${venue.slug}: no Google API key — images[] will be empty`);
      return [];
    }
    if (!venue._googlePlace?.placeId) {
      log("images", `${venue.slug}: no matched Google POI — images[] will be empty`);
      return [];
    }
    return uploadVenueImagesFromGoogleOnly(
      supabase,
      venue,
      imageCount,
      googleApiKey,
      googlePhotoMaxBytes,
      imageRegistry,
    );
  }

  if (googleApiKey && venue._googlePlace?.photoReferences?.length) {
    try {
      const googleUrls = await uploadVenueImagesFromGoogleOnly(
        supabase,
        venue,
        imageCount,
        googleApiKey,
        googlePhotoMaxBytes,
        imageRegistry,
      );
      if (googleUrls.length >= imageCount) return googleUrls;
      log("images", `${venue.slug}: Google partial/failed — falling back to stock (non-strict mode)`);
    } catch (err) {
      log("images", `${venue.slug}: Google pipeline error — stock fallback (${err.message})`);
    }
  }

  log(
    "images",
    `${venue.slug}: stock/Unsplash/Picsum (--no-google or no matched POI / no API key)`,
  );
  return uploadVenueImagesFromStock(supabase, venue, imageCount);
}
