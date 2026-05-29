#!/usr/bin/env node
/**
 * Backfill business_cards.blurhashes from the first image URL.
 *
 * Usage:
 *   node scripts/backfill-business-card-blurhashes.mjs [--dry-run] [--limit 50] [--order-asc]
 */
import { encode } from "blurhash";
import { createSupabaseAdmin, loadEnv, log } from "./seed-business-cards/lib.mjs";
import { thumbPublicUrlFromOriginalPublicUrl } from "./seed-business-cards/thumb.mjs";

const BLUR_SAMPLE_SIZE = 32;
const DOWNLOAD_TIMEOUT_MS = 30_000;

function parseArgs(argv) {
  const args = argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limitRaw = limitIdx >= 0 ? args[limitIdx + 1] : null;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 200;
  return {
    dryRun: args.includes("--dry-run"),
    orderAsc: args.includes("--order-asc"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : 200,
  };
}

async function fetchImageRgb(url) {
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

function publicImageUrl(supabaseUrl, pathOrUrl) {
  const trimmed = String(pathOrUrl ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `${supabaseUrl}/storage/v1/object/public/business-cards/${trimmed.replace(/^\/+/, "")}`;
}

async function main() {
  const cli = parseArgs(process.argv);
  const { url } = loadEnv();
  const supabaseUrl = url.replace(/\/$/, "");
  const supabase = createSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from("business_cards")
    .select("id, images, image, blurhashes")
    .or("blurhashes.is.null,blurhashes.eq.{}")
    .order("created_at", { ascending: cli.orderAsc })
    .limit(cli.limit);

  if (error) throw error;

  let updated = 0;
  for (const row of rows ?? []) {
    const firstImage = Array.isArray(row.images) && row.images[0] ? row.images[0] : row.image;
    const imageUrl = publicImageUrl(supabaseUrl, firstImage);
    if (!imageUrl) continue;

    try {
      const downloadUrl = thumbPublicUrlFromOriginalPublicUrl(imageUrl) ?? imageUrl;
      const { pixels, width, height } = await fetchImageRgb(downloadUrl);
      const hash = encode(pixels, width, height, 4, 3);
      if (cli.dryRun) {
        log("blurhash", `[dry-run] ${row.id} -> ${hash.slice(0, 12)}…`);
        updated += 1;
        continue;
      }
      const { error: upErr } = await supabase
        .from("business_cards")
        .update({ blurhashes: [hash] })
        .eq("id", row.id);
      if (upErr) throw upErr;
      log("blurhash", `updated ${row.id}`);
      updated += 1;
    } catch (err) {
      log("blurhash", `skip ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log("blurhash", `done: ${updated} card(s) ${cli.dryRun ? "(dry-run)" : "updated"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
