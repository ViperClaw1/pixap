#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import {
  DEFAULT_IMAGE_MAX,
  DEFAULT_IMAGE_MIN,
  createRng,
  createSupabaseAdmin,
  log,
  normalizeBusinessCardImages,
  parseCliArgs,
  pickFrom,
  pickInt,
  shuffled,
  withRetry,
} from "./lib.mjs";
import { removeUploadedPostMedia, uploadPostMedia } from "./media.mjs";
import { buildPostContent } from "./templates.mjs";
import {
  ensureUsersForLikes,
  loadValidPublicProfileIds,
} from "./users.mjs";

const RNG_SEED = 20260805;
const cli = parseCliArgs(process.argv);

async function loadBusinessCards(supabase) {
  let query = supabase
    .from("business_cards")
    .select("id, name, city, images, image")
    .limit(1000);
  if (cli.city) query = query.ilike("city", `%${cli.city}%`);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load business_cards: ${error.message}`);

  const cards = (data ?? [])
    .map((card) => ({ ...card, seedImages: normalizeBusinessCardImages(card) }))
    .filter((card) => card.id && card.seedImages.length > 0);

  if (!cards.length) {
    throw new Error(
      cli.city
        ? `No business_cards with reusable images found in city "${cli.city}"`
        : "No business_cards with reusable images found",
    );
  }
  return cards;
}

function createdAtForSlot(slot, rng) {
  const minutesAgo = slot * 23 + pickInt(rng, 2, 20);
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

async function insertPost(supabase, row) {
  return withRetry(
    `insert:${row.place_id}`,
    async () => {
      const { data, error } = await supabase
        .from("posts")
        .insert(row)
        .select("id, user_id, place_id, created_at")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    { attempts: 4, baseDelayMs: 800 },
  );
}

async function insertLikes(supabase, postId, authorId, authors, rng) {
  if (cli.likes === 0) return [];

  const userIds = shuffled(
    authors.filter((userId) => userId !== authorId),
    rng,
  ).slice(0, cli.likes);
  const rows = userIds.map((userId) => ({
    post_id: postId,
    user_id: userId,
    type: "like",
  }));

  return withRetry(
    `likes:${postId}`,
    async () => {
      const { data, error } = await supabase
        .from("post_reactions")
        .insert(rows)
        .select("id");
      if (error) throw new Error(error.message);
      if (data?.length !== cli.likes) {
        throw new Error(`Inserted ${data?.length ?? 0}/${cli.likes} likes`);
      }
      return data;
    },
    { attempts: 4, baseDelayMs: 800 },
  );
}

async function removeInsertedPost(supabase, postId) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) log("cleanup", `Could not remove post ${postId}: ${error.message}`);
}

async function main() {
  const supabase = createSupabaseAdmin();
  const rng = createRng(RNG_SEED);
  let [authors, loadedCards] = await Promise.all([
    loadValidPublicProfileIds(supabase),
    loadBusinessCards(supabase),
  ]);
  const cards = shuffled(loadedCards, rng);

  const requiredUsers = cli.likes + 1;
  if (authors.length < requiredUsers && !cli.createUsers) {
    throw new Error(
      `--likes ${cli.likes} requires at least ${requiredUsers} users with public profiles; found ${authors.length}. Add --create-users to create the missing seed users.`,
    );
  }
  if (authors.length < requiredUsers) {
    authors = await ensureUsersForLikes(supabase, authors, requiredUsers, {
      dryRun: cli.dryRun,
    });
  }

  log(
    "seed",
    `Starting posts seed (count=${cli.count}, authors=${authors.length}, cards=${cards.length}, city=${cli.city ?? "all"}, images=${cli.images ?? `${DEFAULT_IMAGE_MIN}-${DEFAULT_IMAGE_MAX}`}, likes=${cli.likes}, createUsers=${cli.createUsers}, dryRun=${cli.dryRun})`,
  );

  const inserted = [];

  for (let slot = 0; slot < cli.count; slot += 1) {
    const card = cards[slot % cards.length];
    const userId = pickFrom(rng, authors);
    const requestedImages =
      cli.images ?? pickInt(rng, DEFAULT_IMAGE_MIN, DEFAULT_IMAGE_MAX);
    const imageCount = Math.min(requestedImages, card.seedImages.length);
    const sourceUrls = shuffled(card.seedImages, rng);
    const content = buildPostContent(card, slot);
    const createdAt = createdAtForSlot(slot, rng);

    if (cli.dryRun) {
      inserted.push({
        id: "dry-run",
        author: userId,
        place: card.name,
        city: card.city,
        images: imageCount,
        likes: cli.likes,
        created_at: createdAt,
      });
      continue;
    }

    const media = await uploadPostMedia(supabase, {
      userId,
      postToken: randomUUID(),
      sourceUrls,
      imageCount,
    });

    let post = null;
    try {
      post = await insertPost(supabase, {
        user_id: userId,
        place_id: card.id,
        content,
        media_url: JSON.stringify(media.publicUrls),
        media_blurhashes: media.blurhashes,
        created_at: createdAt,
      });
      await insertLikes(supabase, post.id, userId, authors, rng);
      inserted.push({
        ...post,
        place: card.name,
        images: media.publicUrls.length,
        likes: cli.likes,
      });
      log(
        "insert",
        `[${slot + 1}/${cli.count}] ${card.name} — ${media.publicUrls.length} image(s), ${cli.likes} like(s)`,
      );
    } catch (error) {
      if (post?.id) await removeInsertedPost(supabase, post.id);
      await removeUploadedPostMedia(supabase, media.uploadedPaths);
      throw error;
    }
  }

  if (!cli.dryRun) {
    const ids = inserted.map((row) => row.id);
    const { data: verified, error } = await supabase
      .from("posts")
      .select("id")
      .in("id", ids);
    if (error) throw new Error(`Post-insert verification failed: ${error.message}`);
    if (verified?.length !== inserted.length) {
      throw new Error(`Post-insert verification found ${verified?.length ?? 0}/${inserted.length} posts`);
    }
  }

  log("done", `${inserted.length} post(s) ${cli.dryRun ? "planned; no writes performed" : "created"}`);
  console.table(inserted);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
