#!/usr/bin/env node
/**
 * Backfill cuisine_types, menu_items, price_tier and google_place_id for existing business_cards
 * using Google Places New API.
 *
 * Only rows with price_tier IS NULL and empty cuisine_types are auto-queued.
 * --skip/--limit select a fixed window over ALL business_cards by created_at (not the pending queue).
 *
 * Usage:
 *   node scripts/backfill-cuisine-types.mjs
 *   node scripts/backfill-cuisine-types.mjs --city "Paris, France"
 *   node scripts/backfill-cuisine-types.mjs --dry-run
 *   node scripts/backfill-cuisine-types.mjs --limit 50
 *   node scripts/backfill-cuisine-types.mjs --skip 1000 --limit 1000
 *   node scripts/backfill-cuisine-types.mjs --page-size 300 --delay-ms 800
 */
import {
  deriveMenuItemsFromCuisineTypes,
  extractCuisineTypes,
  extractPriceTier,
  loadPlaceDetailsNew,
} from "./seed-business-cards/googleMaps.mjs";
import { createSupabaseAdmin, loadEnv, loadGoogleMapsApiKey, log, sleep } from "./seed-business-cards/lib.mjs";

const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_DELAY_MS = 800;
const FIND_PLACE_DELAY_MS = 350;
/** Pause before each retry when Google returns 403/429 (quota / rate limit). */
const QUOTA_BACKOFF_MS = [90_000, 120_000, 180_000, 300_000];

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
  const skipRaw = argValue(args, "--skip");
  const pageSizeRaw = argValue(args, "--page-size");
  const delayRaw = argValue(args, "--delay-ms");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : null;
  const skip = skipRaw ? Number.parseInt(skipRaw, 10) : 0;
  const pageSize = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : DEFAULT_PAGE_SIZE;
  const delayMs = delayRaw ? Number.parseInt(delayRaw, 10) : DEFAULT_DELAY_MS;
  const cityRaw = argValue(args, "--city");
  return {
    city: cityRaw?.trim() || null,
    delayMs: Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : DEFAULT_DELAY_MS,
    dryRun: args.includes("--dry-run"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 1000) : DEFAULT_PAGE_SIZE,
    skip: Number.isFinite(skip) && skip >= 0 ? skip : 0,
  };
}

function isGoogleQuotaError(err) {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return (
    msg.includes("403") ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("blocked") ||
    msg.includes("over_query_limit")
  );
}

async function loadPlaceDetailsWithQuotaBackoff(placeId, apiKey) {
  let lastErr;
  const maxAttempts = QUOTA_BACKOFF_MS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      const pauseMs = QUOTA_BACKOFF_MS[attempt - 1];
      log(
        "backfill",
        `Quota backoff ${Math.round(pauseMs / 1000)}s before retry ${attempt + 1}/${maxAttempts} (${placeId})`,
      );
      await sleep(pauseMs);
    }

    try {
      return await loadPlaceDetailsNew(placeId, apiKey);
    } catch (err) {
      lastErr = err;
      if (!isGoogleQuotaError(err) || attempt >= maxAttempts - 1) throw err;
      log(
        "backfill",
        `Places New API quota/rate limit (${placeId}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  throw lastErr ?? new Error(`Places New API failed for ${placeId}`);
}

function isAlreadyEnriched(row) {
  return Array.isArray(row.cuisine_types) && row.cuisine_types.length > 0;
}

function buildPendingFilters(query) {
  return query
    .is("price_tier", null)
    .or("cuisine_types.is.null,cuisine_types.eq.{}");
}

function buildCityFilter(query, cli) {
  if (cli.city) {
    return query.eq("city", cli.city);
  }
  return query;
}

async function countPendingVenues(supabase, cli) {
  let query = supabase.from("business_cards").select("*", { count: "exact", head: true });
  query = buildPendingFilters(query);
  query = buildCityFilter(query, cli);
  const { count, error } = await query;
  if (error) throw error;
  if (count == null) {
    throw new Error("countPendingVenues: Supabase returned no count — check service role and project URL");
  }
  return count;
}

async function countAllVenues(supabase, cli) {
  let query = supabase.from("business_cards").select("*", { count: "exact", head: true });
  query = buildCityFilter(query, cli);
  const { count, error } = await query;
  if (error) throw error;
  if (count == null) {
    throw new Error("countAllVenues: Supabase returned no count — check service role and project URL");
  }
  return count;
}

function pendingVenuesQuery(supabase, cli) {
  let query = supabase
    .from("business_cards")
    .select("id, name, city, google_place_id, cuisine_types, price_tier")
    .order("created_at", { ascending: true });
  query = buildPendingFilters(query);
  return buildCityFilter(query, cli);
}

function allVenuesQuery(supabase, cli) {
  let query = supabase
    .from("business_cards")
    .select("id, name, city, google_place_id, cuisine_types, price_tier")
    .order("created_at", { ascending: true });
  return buildCityFilter(query, cli);
}

async function fetchPendingVenuesPage(supabase, cli, offset, pageSize) {
  const { data, error } = await pendingVenuesQuery(supabase, cli).range(
    offset,
    offset + pageSize - 1,
  );
  if (error) throw error;
  return data ?? [];
}

/** Fixed window [skip, skip + limit) over all business_cards by created_at. */
async function fetchVenuesWindow(supabase, cli, windowSize) {
  const venues = [];
  let offset = cli.skip;

  while (venues.length < windowSize) {
    const chunkSize = Math.min(cli.pageSize, windowSize - venues.length);
    const { data, error } = await allVenuesQuery(supabase, cli).range(
      offset,
      offset + chunkSize - 1,
    );
    if (error) throw error;
    const page = data ?? [];
    if (!page.length) break;
    venues.push(...page);
    offset += page.length;
    if (page.length < chunkSize) break;
  }

  return venues.slice(0, windowSize);
}

async function findPlaceIdByName(name, city, apiKey) {
  const cityShort = city?.split(",")[0]?.trim() ?? "";
  const query = cityShort ? `${name} ${cityShort}` : name;
  const url =
    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json?" +
    new URLSearchParams({
      input: query,
      inputtype: "textquery",
      fields: "place_id",
      key: apiKey,
    });
  const res = await fetch(url);
  const data = await res.json();
  await sleep(FIND_PLACE_DELAY_MS);
  return data.candidates?.[0]?.place_id ?? null;
}

async function processVenue(venue, { apiKey, cli, quotaDeferred }) {
  if (quotaDeferred.has(venue.id)) {
    return { skipped: true, deferred: true };
  }

  if (isAlreadyEnriched(venue)) {
    log("backfill", `SKIP ${venue.name} — already has cuisine_types (${venue.cuisine_types.join(", ")})`);
    return { skipped: true, alreadyEnriched: true };
  }

  let placeId = venue.google_place_id?.trim() || null;

  if (!placeId) {
    placeId = await findPlaceIdByName(venue.name, venue.city, apiKey);
    if (!placeId) {
      log("backfill", `SKIP ${venue.name} — no place_id found`);
      return { skipped: true };
    }
  }

  let placeData;
  try {
    placeData = await loadPlaceDetailsWithQuotaBackoff(placeId, apiKey);
  } catch (err) {
    log(
      "backfill",
      `SKIP ${venue.name} — Places New API: ${err instanceof Error ? err.message : String(err)}`,
    );
    if (isGoogleQuotaError(err)) {
      quotaDeferred.add(venue.id);
    }
    return { skipped: true };
  }

  const cuisine_types = extractCuisineTypes(placeData);
  const price_tier = extractPriceTier(placeData);
  const menu_items = deriveMenuItemsFromCuisineTypes(cuisine_types);

  if (cli.dryRun) {
    log(
      "backfill",
      `[dry-run] ${venue.name}: cuisine=[${cuisine_types.join(", ")}] menu=${menu_items.length} tier=${price_tier}`,
    );
    return { updated: true };
  }

  return {
    payload: {
      google_place_id: placeId,
      cuisine_types,
      menu_items,
      price_tier,
    },
    summary: `[${cuisine_types.join(", ")}] menu=${menu_items.length} tier=${price_tier}`,
    updated: true,
    venueId: venue.id,
    venueName: venue.name,
  };
}

async function applyVenueOutcome(supabase, venue, outcome, tallies) {
  if (outcome.deferred) {
    tallies.deferred += 1;
    return;
  }
  if (outcome.skipped) {
    tallies.skipped += 1;
    return;
  }
  if (outcome.updated && outcome.payload && outcome.venueId) {
    const { error: upErr } = await supabase
      .from("business_cards")
      .update(outcome.payload)
      .eq("id", outcome.venueId);

    if (upErr) {
      log("backfill", `FAIL ${outcome.venueName}: ${upErr.message}`);
      tallies.skipped += 1;
      return;
    }

    log("backfill", `OK ${outcome.venueName}: ${outcome.summary}`);
    tallies.updated += 1;
    return;
  }
  if (outcome.updated) {
    tallies.updated += 1;
  }
}

async function runFixedBatch(supabase, cli, apiKey, venueQueue, { rowLabel = "table" } = {}) {
  const tallies = { updated: 0, skipped: 0, processed: 0, deferred: 0, alreadyEnriched: 0 };
  const quotaDeferred = new Set();

  for (let index = 0; index < venueQueue.length; index += 1) {
    const venue = venueQueue[index];
    if (quotaDeferred.has(venue.id)) {
      tallies.deferred += 1;
      continue;
    }

    if (index === 0 || (index + 1) % cli.pageSize === 1) {
      const batchEnd = Math.min(index + cli.pageSize, venueQueue.length);
      const from = cli.skip + index + 1;
      const to = cli.skip + batchEnd;
      log("backfill", `Processing rows ${from}-${to} of ${rowLabel}`);
    }

    const outcome = await processVenue(venue, { apiKey, cli, quotaDeferred });
    if (cli.dryRun) {
      if (outcome.deferred) tallies.deferred += 1;
      else if (outcome.updated) tallies.updated += 1;
      else if (outcome.alreadyEnriched) tallies.alreadyEnriched += 1;
      else tallies.skipped += 1;
    } else {
      if (outcome.alreadyEnriched) {
        tallies.alreadyEnriched += 1;
      } else {
        await applyVenueOutcome(supabase, venue, outcome, tallies);
      }
    }

    tallies.processed += 1;
    if (index + 1 < venueQueue.length && cli.delayMs > 0 && !outcome.alreadyEnriched) {
      await sleep(cli.delayMs);
    }
  }

  return tallies;
}

async function runDynamicQueue(supabase, cli, apiKey, targetTotal) {
  const tallies = { updated: 0, skipped: 0, processed: 0, deferred: 0, alreadyEnriched: 0 };
  const quotaDeferred = new Set();

  while (tallies.processed < targetTotal) {
    const pageSize = Math.min(cli.pageSize, targetTotal - tallies.processed);
    const rawVenues = await fetchPendingVenuesPage(supabase, cli, 0, pageSize);
    const venues = rawVenues.filter((venue) => !quotaDeferred.has(venue.id));

    if (!venues.length) {
      if (quotaDeferred.size > 0) {
        log(
          "backfill",
          `${quotaDeferred.size} venue(s) deferred after quota errors — re-run later to retry`,
        );
      }
      break;
    }

    log(
      "backfill",
      `Fetched ${venues.length} pending row(s) (${tallies.processed + 1}-${tallies.processed + venues.length} of ${targetTotal})`,
    );

    for (const venue of venues) {
      if (tallies.processed >= targetTotal) break;

      const outcome = await processVenue(venue, { apiKey, cli, quotaDeferred });
      if (cli.dryRun) {
        if (outcome.deferred) tallies.deferred += 1;
        else if (outcome.updated) tallies.updated += 1;
        else if (outcome.alreadyEnriched) tallies.alreadyEnriched = (tallies.alreadyEnriched ?? 0) + 1;
        else tallies.skipped += 1;
      } else if (outcome.alreadyEnriched) {
        tallies.alreadyEnriched = (tallies.alreadyEnriched ?? 0) + 1;
      } else {
        await applyVenueOutcome(supabase, venue, outcome, tallies);
      }

      tallies.processed += 1;
      if (tallies.processed < targetTotal && cli.delayMs > 0 && !outcome.alreadyEnriched) {
        await sleep(cli.delayMs);
      }
    }
  }

  return tallies;
}

async function main() {
  const cli = parseArgs(process.argv);
  loadEnv();
  const apiKey = loadGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error("Set EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY for Google Places New API");
  }

  const supabase = createSupabaseAdmin();
  let tallies;

  if (cli.skip > 0) {
    const totalRows = await countAllVenues(supabase, cli);

    if (cli.skip >= totalRows) {
      log(
        "backfill",
        `--skip ${cli.skip} is >= total ${totalRows} business_cards — nothing in this window`,
      );
      return;
    }

    const windowSize = cli.limit
      ? Math.min(cli.limit, totalRows - cli.skip)
      : totalRows - cli.skip;

    log(
      "backfill",
      `Window rows ${cli.skip + 1}-${cli.skip + windowSize} of ${totalRows} business_cards` +
        `${cli.city ? ` in ${cli.city}` : ""} ` +
        `(page-size=${cli.pageSize}, delay=${cli.delayMs}ms, dryRun=${cli.dryRun})`,
    );

    const venueQueue = await fetchVenuesWindow(supabase, cli, windowSize);
    if (!venueQueue.length) {
      log("backfill", "Nothing to do in skip/limit window.");
      return;
    }

    tallies = await runFixedBatch(supabase, cli, apiKey, venueQueue, { rowLabel: "business_cards" });
  } else {
    const pendingTotal = await countPendingVenues(supabase, cli);

    if (pendingTotal === 0) {
      log("backfill", "Nothing to do — no rows with price_tier IS NULL and empty cuisine_types.");
      return;
    }

    const targetTotal = cli.limit ? Math.min(cli.limit, pendingTotal) : pendingTotal;

    log(
      "backfill",
      `Pending ${pendingTotal} venue(s) needing enrichment${cli.city ? ` in ${cli.city}` : ""}; ` +
        `will process ${targetTotal} row(s) ` +
        `(page-size=${cli.pageSize}, delay=${cli.delayMs}ms, dryRun=${cli.dryRun})`,
    );

    tallies = await runDynamicQueue(supabase, cli, apiKey, targetTotal);
  }

  log(
    "backfill",
    `done: ${tallies.updated} venue(s) ${cli.dryRun ? "previewed" : "updated"}, ${tallies.skipped} skipped, ` +
      `${tallies.alreadyEnriched ?? 0} already enriched, ${tallies.deferred} deferred (quota), ${tallies.processed} processed`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
