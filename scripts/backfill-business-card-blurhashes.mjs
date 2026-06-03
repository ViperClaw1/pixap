#!/usr/bin/env node
/**
 * Backfill business_cards.blurhashes from the first image URL.
 *
 * Usage:
 *   node scripts/backfill-business-card-blurhashes.mjs [--dry-run] [--city Paris] [--limit 50] [--order-asc]
 */
import { encode } from "blurhash";
import { createSupabaseAdmin, loadEnv, log } from "./seed-business-cards/lib.mjs";
import { thumbPublicUrlFromOriginalPublicUrl } from "./seed-business-cards/thumb.mjs";

const BLUR_SAMPLE_SIZE = 32;
const DOWNLOAD_TIMEOUT_MS = 30_000;

function argValue(args, name) {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : null;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const limitRaw = argValue(args, "--limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 200;
  const cityRaw = argValue(args, "--city");
  const city = cityRaw?.trim();
  return {
    city: city || null,
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

function preferredDownloadUrls(imageUrl) {
  return [thumbPublicUrlFromOriginalPublicUrl(imageUrl), imageUrl].filter((url, index, urls) => url && urls.indexOf(url) === index);
}

function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

async function fetchFirstImageRgb(urls) {
  const errors = [];
  for (const url of urls) {
    try {
      return await fetchImageRgb(url);
    } catch (err) {
      const source = url.includes("_thumb.") ? "thumb" : "original";
      errors.push(`${source}: ${errorMessage(err)}`);
    }
  }
  throw new Error(errors.join("; ") || "no downloadable image URL");
}

async function main() {
  const cli = parseArgs(process.argv);
  const { url } = loadEnv();
  const supabaseUrl = url.replace(/\/$/, "");
  const supabase = createSupabaseAdmin();

  let query = supabase
    .from("business_cards")
    .select("id, city, images, image, blurhashes")
    .or("blurhashes.is.null,blurhashes.eq.{}")
    .order("created_at", { ascending: cli.orderAsc });

  if (cli.city) {
    query = query.eq("city", cli.city);
  }

  const { data: rows, error } = await query.limit(cli.limit);

  if (error) throw error;

  if (cli.city) {
    log("blurhash", `city filter: ${cli.city}`);
  }

  let updated = 0;
  for (const row of rows ?? []) {
    const firstImage = Array.isArray(row.images) && row.images[0] ? row.images[0] : row.image;
    const imageUrl = publicImageUrl(supabaseUrl, firstImage);
    if (!imageUrl) continue;

    try {
      const { pixels, width, height } = await fetchFirstImageRgb(preferredDownloadUrls(imageUrl));
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
      log("blurhash", `skip ${row.id}: ${errorMessage(err)}`);
    }
  }

  log("blurhash", `done: ${updated} card(s) ${cli.dryRun ? "(dry-run)" : "updated"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
