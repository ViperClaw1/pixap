#!/usr/bin/env node
/**
 * Backfill posts.media_blurhashes and stories.media_blurhashes from media_url slide(s).
 *
 * Usage:
 *   node scripts/backfill-feed-media-blurhashes.mjs [--dry-run] [--limit 200]
 *   node scripts/backfill-feed-media-blurhashes.mjs --posts-only --limit 500
 *   node scripts/backfill-feed-media-blurhashes.mjs --stories-only
 */
import { createSupabaseAdmin, loadEnv, log, sleep } from "./seed-business-cards/lib.mjs";
import {
  encodeBlurhashFromUrl,
  needsBlurhashBackfill,
  parseArgs,
  parseExistingBlurhashes,
  parseMediaUrls,
  preferredDownloadUrl,
  publicStoriesMediaUrl,
} from "./lib/blurhashBackfill.mjs";

const ROW_DELAY_MS = 80;

async function backfillTable(supabase, supabaseUrl, tableName, kind, cli) {
  const { data: rows, error } = await supabase
    .from(tableName)
    .select("id, media_url, media_blurhashes, created_at")
    .order("created_at", { ascending: false })
    .limit(cli.limit);

  if (error) throw new Error(`${tableName}: ${error.message}`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    const urls = parseMediaUrls(row.media_url).map((u) => publicStoriesMediaUrl(supabaseUrl, u)).filter(Boolean);
    const existing = parseExistingBlurhashes(row.media_blurhashes);

    if (!needsBlurhashBackfill(urls, existing)) {
      skipped += 1;
      continue;
    }

    const next = [...existing];
    while (next.length < urls.length) next.push(null);

    let changed = false;
    for (let i = 0; i < urls.length; i += 1) {
      if (next[i]) continue;
      const publicUrl = urls[i];
      const downloadUrl = preferredDownloadUrl(publicUrl, { kind });
      if (!downloadUrl) {
        next[i] = null;
        continue;
      }
      try {
        next[i] = await encodeBlurhashFromUrl(downloadUrl);
        changed = true;
      } catch (err) {
        log(
          "blurhash",
          `skip ${tableName} ${row.id} slide ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
        );
        next[i] = null;
      }
    }

    if (!changed || !next.some((h) => h)) {
      skipped += 1;
      continue;
    }

    const payload = next.map((h) => h ?? null);

    if (cli.dryRun) {
      log(
        "blurhash",
        `[dry-run] ${tableName} ${row.id} -> ${payload.filter(Boolean).length}/${urls.length} hash(es)`,
      );
      updated += 1;
      continue;
    }

    const { error: upErr } = await supabase.from(tableName).update({ media_blurhashes: payload }).eq("id", row.id);
    if (upErr) throw new Error(`${tableName} ${row.id}: ${upErr.message}`);
    log("blurhash", `updated ${tableName} ${row.id} (${payload.filter(Boolean).length}/${urls.length})`);
    updated += 1;
    await sleep(ROW_DELAY_MS);
  }

  log("blurhash", `${tableName}: ${updated} updated, ${skipped} skipped (limit ${cli.limit})`);
  return updated;
}

async function main() {
  const cli = parseArgs(process.argv, { defaultLimit: 200 });
  const runPosts = !cli.storiesOnly;
  const runStories = !cli.postsOnly;

  if (!runPosts && !runStories) {
    throw new Error("Use --posts-only and/or --stories-only (default: both tables)");
  }

  const { url } = loadEnv();
  const supabaseUrl = url.replace(/\/$/, "");
  const supabase = createSupabaseAdmin();

  let total = 0;
  if (runPosts) {
    total += await backfillTable(supabase, supabaseUrl, "posts", "post", cli);
  }
  if (runStories) {
    total += await backfillTable(supabase, supabaseUrl, "stories", "story", cli);
  }

  log("blurhash", `done: ${total} row(s) ${cli.dryRun ? "(dry-run)" : "updated"} across feed media`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
