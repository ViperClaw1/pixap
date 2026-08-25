#!/usr/bin/env node
/**
 * Rewrites posts.content with varied copy (place name / city when available).
 *
 * Usage:
 *   node scripts/seed-posts/randomize-content.mjs
 *   node scripts/seed-posts/randomize-content.mjs --dry-run
 *   node scripts/seed-posts/randomize-content.mjs --limit 50
 */
import {
  createRng,
  createSupabaseAdmin,
  log,
  withRetry,
} from "./lib.mjs";
import { buildPostContent } from "./templates.mjs";

const PAGE_SIZE = 200;
const UPDATE_CHUNK = 25;
const RNG_SEED = Date.now() ^ 0x51eed;

function parseArgs(argv) {
  const args = argv.slice(2);
  let limit = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--dry-run") continue;
    if (arg === "--limit" || arg.startsWith("--limit=")) {
      const raw = arg.startsWith("--limit=") ? arg.slice("--limit=".length) : args[++i];
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid --limit: ${raw}`);
      limit = n;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { dryRun: args.includes("--dry-run"), limit };
}

async function loadAllPosts(supabase, limit) {
  const posts = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("posts")
      .select("id, content, place_id, geo_place_name, geo_formatted_address, created_at")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(`Could not load posts: ${error.message}`);
    const page = data ?? [];
    posts.push(...page);
    if (limit != null && posts.length >= limit) return posts.slice(0, limit);
    if (page.length < PAGE_SIZE) break;
  }
  return posts;
}

async function loadPlacesById(supabase, placeIds) {
  const unique = [...new Set(placeIds.filter(Boolean))];
  const map = new Map();
  for (let offset = 0; offset < unique.length; offset += 200) {
    const chunk = unique.slice(offset, offset + 200);
    const { data, error } = await supabase
      .from("business_cards")
      .select("id, name, city")
      .in("id", chunk);
    if (error) throw new Error(`Could not load business_cards: ${error.message}`);
    for (const row of data ?? []) map.set(row.id, row);
  }
  return map;
}

function placeContext(post, places) {
  const card = post.place_id ? places.get(post.place_id) : null;
  if (card) {
    return {
      name: card.name?.trim() || "this place",
      city: card.city?.trim() || "",
    };
  }
  return {
    name: post.geo_place_name?.trim() || "this place",
    city: "",
  };
}

async function updatePosts(supabase, updates) {
  for (let offset = 0; offset < updates.length; offset += UPDATE_CHUNK) {
    const chunk = updates.slice(offset, offset + UPDATE_CHUNK);
    await Promise.all(
      chunk.map((row) =>
        withRetry(
          `update:${row.id}`,
          async () => {
            const { error } = await supabase
              .from("posts")
              .update({ content: row.content })
              .eq("id", row.id);
            if (error) throw new Error(error.message);
          },
          { attempts: 4, baseDelayMs: 600 },
        ),
      ),
    );
    log("update", `${Math.min(offset + chunk.length, updates.length)}/${updates.length}`);
  }
}

async function main() {
  const cli = parseArgs(process.argv);
  const supabase = createSupabaseAdmin();
  const rng = createRng(RNG_SEED);

  const posts = await loadAllPosts(supabase, cli.limit);
  if (!posts.length) {
    log("done", "No posts found");
    return;
  }

  const places = await loadPlacesById(
    supabase,
    posts.map((p) => p.place_id),
  );

  const updates = posts.map((post, index) => {
    const card = placeContext(post, places);
    return {
      id: post.id,
      place: card.name,
      before: post.content,
      content: buildPostContent(card, index, rng),
    };
  });

  log(
    "seed",
    `Rewording ${updates.length} post(s)${cli.dryRun ? " (dry-run)" : ""}`,
  );

  if (cli.dryRun) {
    console.table(
      updates.slice(0, 15).map((u) => ({
        id: u.id.slice(0, 8),
        place: u.place.slice(0, 28),
        before: u.before.slice(0, 48),
        after: u.content.slice(0, 48),
      })),
    );
    if (updates.length > 15) log("seed", `…and ${updates.length - 15} more`);
    log("done", "Dry run complete — no writes");
    return;
  }

  await updatePosts(supabase, updates);
  log("done", `Updated ${updates.length} post(s)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
