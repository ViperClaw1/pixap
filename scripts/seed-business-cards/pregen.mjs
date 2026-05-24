/**
 * Pre-generated business-cards variants (object/public — no Supabase render quota).
 */
import { BUSINESS_CARDS_BUCKET, STORAGE_CACHE_CONTROL, toNodeBuffer, withRetry } from "./lib.mjs";

export const BUSINESS_CARD_PREGEN_VARIANTS = {
  thumb: { suffix: "_thumb", file: "_thumb.webp", longEdge: 256, quality: 72 },
  hero: { suffix: "_hero", file: "_hero.webp", longEdge: 720, quality: 76 },
  gallery: { suffix: "_gallery", file: "_gallery.webp", longEdge: 1080, quality: 78 },
};

const PREGEN_FILES = new Set(Object.values(BUSINESS_CARD_PREGEN_VARIANTS).map((v) => v.file));

/** `folder/01.jpg` → `folder/01_thumb.webp` */
export function businessCardPregenStoragePath(objectPath, variantKey) {
  const def = BUSINESS_CARD_PREGEN_VARIANTS[variantKey];
  if (!def) return null;
  const trimmed = String(objectPath ?? "").trim().replace(/^\/+/, "");
  if (!trimmed || PREGEN_FILES.has(trimmed)) return null;
  const base = trimmed.replace(/\.[^./]+$/, "");
  if (!base || base === trimmed) return null;
  return `${base}${def.file}`;
}

export function pregenObjectPathFromPublicUrl(publicUrl, variantKey) {
  if (!publicUrl?.includes("/object/public/business-cards/")) return null;
  const objectPath = publicUrl.split("/object/public/business-cards/")[1]?.split("?")[0]?.split("#")[0] ?? "";
  return businessCardPregenStoragePath(objectPath, variantKey);
}

export function pregenPublicUrlFromOriginalPublicUrl(publicUrl, variantKey) {
  const pregenPath = pregenObjectPathFromPublicUrl(publicUrl, variantKey);
  if (!pregenPath) return null;
  const marker = "/object/public/business-cards/";
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return null;
  return `${publicUrl.slice(0, idx + marker.length)}${pregenPath}`;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} originalObjectPath
 * @param {Buffer} sourceBytes
 * @param {"thumb"|"hero"|"gallery"} variantKey
 */
export async function uploadBusinessCardPregen(supabase, originalObjectPath, sourceBytes, variantKey) {
  const def = BUSINESS_CARD_PREGEN_VARIANTS[variantKey];
  if (!def) return null;
  const pregenPath = businessCardPregenStoragePath(originalObjectPath, variantKey);
  if (!pregenPath) return null;

  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return null;
  }

  const pregenBytes = await sharp(sourceBytes)
    .rotate()
    .resize(def.longEdge, def.longEdge, { fit: "cover", position: "centre" })
    .webp({ quality: def.quality })
    .toBuffer();

  const body = toNodeBuffer(pregenBytes);
  await withRetry(`pregen:${pregenPath}`, async () => {
    const { error } = await supabase.storage.from(BUSINESS_CARDS_BUCKET).upload(pregenPath, body, {
      contentType: "image/webp",
      cacheControl: STORAGE_CACHE_CONTROL,
      upsert: true,
    });
    if (error) throw new Error(`pregen upload ${pregenPath}: ${error.message}`);
  });

  const { data } = supabase.storage.from(BUSINESS_CARDS_BUCKET).getPublicUrl(pregenPath);
  return data.publicUrl;
}

/** Upload thumb + hero + gallery in one pass (same source bytes). */
export async function uploadBusinessCardAllPregens(supabase, originalObjectPath, sourceBytes) {
  const urls = {};
  for (const key of Object.keys(BUSINESS_CARD_PREGEN_VARIANTS)) {
    urls[key] = await uploadBusinessCardPregen(supabase, originalObjectPath, sourceBytes, key);
  }
  return urls;
}
