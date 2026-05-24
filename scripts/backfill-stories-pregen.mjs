#!/usr/bin/env node
/**
 * Generate `*_feed.webp` / `*_story.webp` for existing objects in the stories bucket.
 *
 * Usage:
 *   node scripts/backfill-stories-pregen.mjs [--dry-run] [--limit 200]
 */
import { createSupabaseAdmin, log, toNodeBuffer } from "./seed-business-cards/lib.mjs";

const STORIES_BUCKET = "stories";

const VARIANTS = {
  feed: { file: "_feed.webp", longEdge: 720, quality: 76, match: (p) => p.includes("/post-") },
  story: { file: "_story.webp", longEdge: 1080, quality: 78, match: (p) => p.includes("/story-") },
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limitRaw = limitIdx >= 0 ? args[limitIdx + 1] : null;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 300;
  return {
    dryRun: args.includes("--dry-run"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : 300,
  };
}

function pregenPath(objectPath, file) {
  const trimmed = objectPath.replace(/^\/+/, "");
  if (!trimmed || trimmed.endsWith(file)) return null;
  const base = trimmed.replace(/\.[^./]+$/, "");
  if (!base || base === trimmed) return null;
  return `${base}${file}`;
}

async function downloadObjectBytes(supabase, objectPath) {
  const { data, error } = await supabase.storage.from(STORIES_BUCKET).download(objectPath);
  if (error) throw error;
  return toNodeBuffer(Buffer.from(await data.arrayBuffer()));
}

async function pregenExists(supabase, path) {
  const { error } = await supabase.storage.from(STORIES_BUCKET).download(path);
  return !error;
}

async function uploadPregen(supabase, objectPath, bytes, variantKey) {
  const def = VARIANTS[variantKey];
  const outPath = pregenPath(objectPath, def.file);
  if (!outPath) return null;

  const sharp = (await import("sharp")).default;
  const body = await sharp(bytes)
    .rotate()
    .resize(def.longEdge, def.longEdge, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: def.quality })
    .toBuffer();

  const { error } = await supabase.storage.from(STORIES_BUCKET).upload(outPath, toNodeBuffer(body), {
    contentType: "image/webp",
    cacheControl: "public, max-age=31536000, immutable",
    upsert: true,
  });
  if (error) throw new Error(`${outPath}: ${error.message}`);
  return outPath;
}

async function main() {
  const cli = parseArgs(process.argv);
  const supabase = createSupabaseAdmin();

  const { data: objects, error } = await supabase.storage.from(STORIES_BUCKET).list("", { limit: cli.limit });
  if (error) throw error;

  let created = 0;
  let skipped = 0;

  async function walk(prefix) {
    const { data: entries, error: listErr } = await supabase.storage.from(STORIES_BUCKET).list(prefix, { limit: 1000 });
    if (listErr) throw listErr;
    for (const entry of entries ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!entry.id) {
        await walk(path);
        continue;
      }
      if (path.includes("_feed.") || path.includes("_story.")) continue;
      if (!/\.(jpe?g|png|webp)$/i.test(path)) continue;

      const variantKey = Object.keys(VARIANTS).find((k) => VARIANTS[k].match(path));
      if (!variantKey) continue;

      const def = VARIANTS[variantKey];
      const out = pregenPath(path, def.file);
      if (!out) continue;

      if (await pregenExists(supabase, out)) {
        skipped += 1;
        continue;
      }

      if (cli.dryRun) {
        log("stories-pregen", `[dry-run] would create ${out}`);
        created += 1;
        continue;
      }

      try {
        const bytes = await downloadObjectBytes(supabase, path);
        await uploadPregen(supabase, path, bytes, variantKey);
        log("stories-pregen", `created ${out}`);
        created += 1;
      } catch (err) {
        log("stories-pregen", `skip ${path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  await walk("");
  log("stories-pregen", `done: ${created} file(s) ${cli.dryRun ? "(dry-run)" : "created"}, ${skipped} already present`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
