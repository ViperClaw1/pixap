#!/usr/bin/env node
/**
 * Generate `*_thumb.webp` for existing business-cards storage objects (no render API).
 *
 * Usage:
 *   node scripts/backfill-business-card-thumbs.mjs [--dry-run] [--limit 100]
 */
import { BUSINESS_CARDS_BUCKET, createSupabaseAdmin, log, toNodeBuffer } from "./seed-business-cards/lib.mjs";
import {
  businessCardThumbStoragePath,
  uploadBusinessCardThumb,
} from "./seed-business-cards/thumb.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limitRaw = limitIdx >= 0 ? args[limitIdx + 1] : null;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 500;
  return {
    dryRun: args.includes("--dry-run"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : 500,
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

async function thumbExists(supabase, thumbPath) {
  const { error } = await supabase.storage.from(BUSINESS_CARDS_BUCKET).download(thumbPath);
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
      if (!objectPath || objectPath.includes("_thumb.")) continue;
      const thumbPath = businessCardThumbStoragePath(objectPath);
      if (!thumbPath) continue;
      const key = thumbPath;
      if (seen.has(key)) continue;
      seen.add(key);

      if (await thumbExists(supabase, thumbPath)) {
        skipped += 1;
        continue;
      }

      if (cli.dryRun) {
        log("thumb", `[dry-run] would create ${thumbPath}`);
        created += 1;
        continue;
      }

      try {
        const bytes = await downloadObjectBytes(supabase, objectPath);
        await uploadBusinessCardThumb(supabase, objectPath, bytes);
        log("thumb", `created ${thumbPath}`);
        created += 1;
      } catch (err) {
        log("thumb", `skip ${objectPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  log("thumb", `done: ${created} thumb(s) ${cli.dryRun ? "(dry-run)" : "created"}, ${skipped} already present`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
