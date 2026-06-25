#!/usr/bin/env node
/**
 * One-shot script: scan all business_cards where external_booking_platform IS NULL,
 * detect Resy / OpenTable / Tock from the venue's website field, and backfill
 * external_booking_platform + external_booking_url.
 *
 * Usage (reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from root .env automatically):
 *   node backend/wa-booking-service/scripts/backfill-external-booking-detection.js --dry-run
 *
 * Or pass inline (PowerShell):
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."; node backend/wa-booking-service/scripts/backfill-external-booking-detection.js --dry-run
 *
 * Add --limit=50 to cap how many rows are processed.
 */

const fs = require('fs');
const path = require('path');

// Load .env from repo root (3 levels up from scripts/) — same pattern as sync-retell-agent.js
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
    const val = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  }
})();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  return arg ? Number.parseInt(arg.split('=')[1], 10) : 2000;
})();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const PLATFORM_PATTERNS = [
  { platform: 'resy', patterns: ['resy.com'] },
  { platform: 'opentable', patterns: ['opentable.com'] },
  { platform: 'tock', patterns: ['exploretock.com', 'tock.com'] },
];

/**
 * Detect external booking platform from a website URL string.
 * Returns { platform, url } or null.
 */
function detectFromWebsite(website) {
  if (!website || typeof website !== 'string') return null;
  const lower = website.toLowerCase();
  for (const { platform, patterns } of PLATFORM_PATTERNS) {
    if (patterns.some((p) => lower.includes(p))) {
      return { platform, url: website };
    }
  }
  return null;
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

async function main() {
  console.log(`[backfill] DRY_RUN=${DRY_RUN}, LIMIT=${LIMIT}`);
  console.log(`[backfill] SUPABASE_URL=${SUPABASE_URL ?? '(not set)'}`);
  console.log(
    `[backfill] SERVICE_KEY=${SERVICE_KEY ? `${SERVICE_KEY.slice(0, 12)}...${SERVICE_KEY.slice(-6)} (len=${SERVICE_KEY.length})` : '(not set)'}`,
  );

  // Fetch all business_cards without external_booking_platform set, that have a website/phone field
  const rows = await sbFetch(
    `business_cards?select=id,name,phone&external_booking_platform=is.null&limit=${LIMIT}`,
    { method: 'GET', headers: { Prefer: 'return=representation' } },
  );

  console.log(`[backfill] Fetched ${rows.length} rows to scan.`);

  let detected = 0;
  let updated = 0;
  let failed = 0;

  // Known venues to hard-code (from transcript evidence)
  const KNOWN_OVERRIDES = [
    {
      name_match: 'Eleven Madison Park',
      platform: 'resy',
      url: 'https://resy.com/cities/nyc/eleven-madison-park',
    },
    {
      name_match: 'Clemente Bar',
      platform: 'resy',
      url: 'https://resy.com/cities/nyc/clemente-bar',
    },
  ];

  for (const row of rows) {
    // Check known overrides first
    const override = KNOWN_OVERRIDES.find(
      (o) =>
        o.name_match &&
        row.name &&
        row.name.toLowerCase().includes(o.name_match.toLowerCase()),
    );

    const match = override
      ? { platform: override.platform, url: override.url }
      : null; // website field not in current select; extend query if needed

    if (!match) continue;

    detected += 1;
    console.log(
      `[backfill] DETECTED  id=${row.id}  name="${row.name}"  → ${match.platform}  ${match.url}`,
    );

    if (DRY_RUN) continue;

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
  }

  console.log(
    `[backfill] Done. detected=${detected}, updated=${updated}, failed=${failed}, dry_run=${DRY_RUN}`,
  );
  console.log(
    '[backfill] TIP: To detect from website URLs, add `website` to the select query above and remove the KNOWN_OVERRIDES pattern.\n' +
      '           Currently business_cards has no `website` column; add it to the schema if you have venue website data.',
  );
}

main().catch((err) => {
  console.error('[backfill] Fatal:', err);
  process.exit(1);
});
