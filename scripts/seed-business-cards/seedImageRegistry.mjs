import { createHash } from "node:crypto";
import { log, toNodeBuffer } from "./lib.mjs";

/** @typedef {{ usedPhotoRefs: Set<string>, usedFingerprints: Set<string>, usedPublicUrls: Set<string> }} SeedImageRegistry */

export function createSeedImageRegistry() {
  return {
    usedPhotoRefs: new Set(),
    usedFingerprints: new Set(),
    usedPublicUrls: new Set(),
  };
}

export function fingerprintImageBytes(bytes) {
  return createHash("sha256").update(toNodeBuffer(bytes)).digest("hex").slice(0, 24);
}

/**
 * @param {SeedImageRegistry} registry
 * @param {string[]} urls
 */
export function registerExistingImageUrls(registry, urls) {
  for (const url of urls) {
    const trimmed = url?.trim();
    if (trimmed) registry.usedPublicUrls.add(trimmed);
  }
}

/**
 * @param {SeedImageRegistry} registry
 * @param {string} photoRef
 * @param {ArrayBuffer} bytes
 * @param {string} publicUrl
 * @returns {string | null} skip reason, or null if unique
 */
export function checkImageUnique(registry, photoRef, bytes) {
  if (registry.usedPhotoRefs.has(photoRef)) {
    return "photo_reference already used for another venue in this run";
  }
  const fp = fingerprintImageBytes(bytes);
  if (registry.usedFingerprints.has(fp)) {
    return "identical image bytes already uploaded for another venue";
  }
  return null;
}

/**
 * @param {SeedImageRegistry} registry
 * @param {string} photoRef
 * @param {ArrayBuffer} bytes
 * @param {string} publicUrl
 */
export function registerUploadedImage(registry, photoRef, bytes, publicUrl) {
  registry.usedPhotoRefs.add(photoRef);
  registry.usedFingerprints.add(fingerprintImageBytes(bytes));
  registry.usedPublicUrls.add(publicUrl);
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {SeedImageRegistry} registry
 * @param {{ cities: string[], categoryId?: string | null }} options
 */
export async function loadExistingImageUrls(supabase, registry, { cities, categoryId = null }) {
  if (!cities.length) return;

  let query = supabase.from("business_cards").select("images").in("city", cities).limit(5000);
  if (categoryId) query = query.eq("category_id", categoryId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load existing image URLs: ${error.message}`);

  let count = 0;
  for (const row of data ?? []) {
    for (const url of row.images ?? []) {
      if (typeof url === "string" && url.trim()) {
        registry.usedPublicUrls.add(url.trim());
        count += 1;
      }
    }
  }

  if (count) {
    log("dedupe", `Tracked ${count} existing image URL(s) from catalogue (no cross-venue reuse)`);
  }
}
