#!/usr/bin/env node
/**
 * Generate `*_thumb.webp`, `*_hero.webp`, `*_gallery.webp` for business-cards storage objects.
 *
 * Usage:
 *   node scripts/backfill-business-card-pregen.mjs [--dry-run] [--limit 100]
 *   node scripts/backfill-business-card-pregen.mjs --variants thumb,hero
 */
import { BUSINESS_CARDS_BUCKET, createSupabaseAdmin, log, toNodeBuffer } from "./seed-business-cards/lib.mjs";
import {
  BUSINESS_CARD_PREGEN_VARIANTS,
  businessCardPregenStoragePath,
  uploadBusinessCardPregen,
} from "./seed-business-cards/pregen.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limitRaw = limitIdx >= 0 ? args[limitIdx + 1] : null;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 500;
  const variantsIdx = args.indexOf("--variants");
  const variantsRaw = variantsIdx >= 0 ? args[variantsIdx + 1] : "thumb,hero,gallery";
  const variants = variantsRaw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v in BUSINESS_CARD_PREGEN_VARIANTS);
  return {
    dryRun: args.includes("--dry-run"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : 500,
    variants: variants.length > 0 ? variants : ["thumb", "hero", "gallery"],
  };
}

function objectPathFromPublicUrl(url) {
  const marker = "/object/public/business-cards/";
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return url.slice(idx + marker.length).split("?")[0]?.split("#")[0] ?? null;
}

async function downloadObjectBytes(supabase, objectPath) {
  const { data, error } = await supabase.storage.from(BUSINESS_CARDS_BUCKET).download(objectPath);
  if (error) throw error;
  return toNodeBuffer(Buffer.from(await data.arrayBuffer()));
}

async function pregenExists(supabase, pregenPath) {
  const { error } = await supabase.storage.from(BUSINESS_CARDS_BUCKET).download(pregenPath);
  return !error;
}

async function main() {
  const cli = parseArgs(process.argv);
  const supabase = createSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from("business_cards")
    .select("id, images, image")
    .order("created_at", { ascending: false })
    .limit(cli.limit);

  if (error) throw error;

  const seen = new Set();
  let created = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    const urls = [];
    if (Array.isArray(row.images)) urls.push(...row.images);
    if (row.image) urls.push(row.image);

    for (const url of urls) {
      if (typeof url !== "string" || !url.includes("/object/public/business-cards/")) continue;
      const objectPath = objectPathFromPublicUrl(url);
      if (!objectPath || objectPath.includes("_thumb.") || objectPath.includes("_hero.") || objectPath.includes("_gallery.")) {
        continue;
      }

      const key = objectPath;
      if (seen.has(key)) continue;
      seen.add(key);

      let bytes = null;
      for (const variantKey of cli.variants) {
        const pregenPath = businessCardPregenStoragePath(objectPath, variantKey);
        if (!pregenPath) continue;

        if (await pregenExists(supabase, pregenPath)) {
          skipped += 1;
          continue;
        }

        if (cli.dryRun) {
          log("pregen", `[dry-run] would create ${pregenPath}`);
          created += 1;
          continue;
        }

        try {
          if (!bytes) bytes = await downloadObjectBytes(supabase, objectPath);
          await uploadBusinessCardPregen(supabase, objectPath, bytes, variantKey);
          log("pregen", `created ${pregenPath}`);
          created += 1;
        } catch (err) {
          log("pregen", `skip ${objectPath} (${variantKey}): ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  log("pregen", `done: ${created} file(s) ${cli.dryRun ? "(dry-run)" : "created"}, ${skipped} already present`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
