#!/usr/bin/env node
/**
 * One-shot script: scan all business_cards where external_booking_platform IS NULL,
 * fetch websiteUri from Google Places API (New) using the stored google_place_id,
 * detect Resy / OpenTable / Tock, and backfill external_booking_platform + external_booking_url.
 *
 * Usage (reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + GOOGLE_MAPS_API_KEY from root .env):
 *   node backend/wa-booking-service/scripts/backfill-external-booking-detection.js --dry-run
 *
 * Flags:
 *   --dry-run      Print detections without writing to DB
 *   --limit=N      Cap rows processed (default 2000)
 *   --concurrency=N  Parallel Places API requests (default 3)
 */

const fs = require('fs');
const path = require('path');

(function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  }
})();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  return arg ? Number.parseInt(arg.split('=')[1], 10) : 2000;
})();
const CONCURRENCY = (() => {
  const arg = process.argv.find((a) => a.startsWith('--concurrency='));
  return arg ? Number.parseInt(arg.split('=')[1], 10) : 3;
})();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}
if (!GOOGLE_API_KEY) {
  console.error('Set GOOGLE_MAPS_API_KEY env var (needed for Places API calls).');
  process.exit(1);
}

async function sbFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text.slice(0, 400)}`);
  }
  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) return response.json();
  return null;
}

async function runInChunks(items, concurrency, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

async function main() {
  console.log(`[backfill] DRY_RUN=${DRY_RUN}, LIMIT=${LIMIT}, CONCURRENCY=${CONCURRENCY}`);

  const { loadPlaceDetailsNew, extractExternalBookingInfo } = await import(
    '../../../scripts/seed-business-cards/googleMaps.mjs'
  );

  const rows = await sbFetch(
    `business_cards?select=id,name,google_place_id&external_booking_platform=is.null&google_place_id=not.is.null&limit=${LIMIT}`,
    { method: 'GET', headers: { Prefer: 'return=representation' } },
  );

  console.log(`[backfill] Fetched ${rows.length} rows with google_place_id to scan.`);

  let detected = 0;
  let updated = 0;
  let failed = 0;

  await runInChunks(rows, CONCURRENCY, async (row) => {
    let placeData;
    try {
      placeData = await loadPlaceDetailsNew(row.google_place_id, GOOGLE_API_KEY);
    } catch (err) {
      console.warn(`[backfill] Places API error for id=${row.id} place=${row.google_place_id}: ${String(err)}`);
      return;
    }

    const match = extractExternalBookingInfo(placeData);
    if (!match.platform) return;

    detected += 1;
    console.log(
      `[backfill] DETECTED  id=${row.id}  name="${row.name}"  → ${match.platform}  ${match.url}`,
    );

    if (DRY_RUN) return;

    try {
      await sbFetch(`business_cards?id=eq.${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          external_booking_platform: match.platform,
          external_booking_url: match.url,
        }),
      });
      updated += 1;
      console.log(`[backfill] UPDATED   id=${row.id}`);
    } catch (err) {
      failed += 1;
      console.error(`[backfill] FAILED    id=${row.id}  error=${String(err)}`);
    }
  });

  console.log(
    `[backfill] Done. detected=${detected}, updated=${updated}, failed=${failed}, dry_run=${DRY_RUN}`,
  );
}

main().catch((err) => {
  console.error('[backfill] Fatal:', err);
  process.exit(1);
});
