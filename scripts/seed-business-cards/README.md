# Seed `business_cards`

Reusable Node script: downloads photos (Google Places or stock), uploads to Supabase Storage (`business-cards`), batch-inserts venues with **all 6 app locales** (`en` base + `ru`, `es`, `pt`, `fr`, `de`). Default batch size: **10** (`--count`).

## Schema (inspect via CLI)

The table is **not** created in this repo’s migrations (pre-existing). Inspect the live schema:

```powershell
cd d:\pixap
npx supabase link --project-ref ylcyktbppowabnxuwdrr
npx supabase db execute --query "
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'business_cards'
  ORDER BY ordinal_position;
"
```

Or use the Supabase SQL editor / MCP `execute_sql` on project `ylcyktbppowabnxuwdrr`.

### Columns filled by this seed

| Column | Notes |
|--------|--------|
| `name`, `description`, `tags` | English (base) |
| `name_*`, `description_*`, `tags_*` | `ru`, `es`, `pt`, `fr`, `de` |
| `type` | Single `business_card_type` enum (`featured` \| `recommended`) for all locales |
| `category_id` | FK → `public.categories` |
| `city`, `address`, `location`, `latitude`, `longitude` | `location` = address + `(approx. lat, lng)` (same pattern as existing catalogue rows) |
| `phone`, `contact_whatsapp` | E.164-style |
| `rating` | Deterministic jitter from seed `20260522` |
| `booking_price` | Always `0` (updated only after venue owner confirms booking cost) |
| `images`, `image` | 3–6 public URLs in `business-cards` bucket |
| `created_at` | DB default |

On project **pix**, `location` is a **text** column (human-readable place label + approximate coordinates). The seed script sets it from `address` + `latitude` / `longitude`. Some local migrations define a generated PostGIS column instead — inserts still send `location` when the column is writable text.

### Fields **not** in `business_cards` (do not seed)

These were requested but **do not exist** on the table today:

- `website`, `instagram`, `opening_hours`, `reviews_count`

Reviews are loaded from `public_reviews` by `business_card_id` in the app (`useReviews`), not stored on the card row.

## Prerequisites

1. **Node.js 18+** (built-in `fetch`).
2. **Service role key** (bypasses RLS for insert + storage upload):

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://ylcyktbppowabnxuwdrr.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<from Dashboard → Settings → API>
   ```

   Put them in `.env` at the repo root (never commit the service role key).

3. **Optional — Google Places photos** (recommended):

   ```env
   EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY=<same or dedicated key>
   ```

   Enable **Places API** + **Geocoding API** on that key.

4. Migrations applied, especially `20260531120000_business_cards_i18n_columns.sql` and `business-cards` storage bucket.

## Run

```powershell
cd d:\pixap

# Validate generation only (no network uploads / DB writes)
node scripts/seed-business-cards/seed.mjs --dry-run

# All 10 venues in one city (string as passed, e.g. Paris → Paris, France)
node scripts/seed-business-cards/seed.mjs --city Paris

# Same with explicit form
node scripts/seed-business-cards/seed.mjs --city="New York"

# Shorthand (typo-friendly): `--Istanbul` is parsed as `--city Istanbul`
node scripts/seed-business-cards/seed.mjs --count 20 --type Bars --Istanbul --tags "bars,drink,lounge"

# No --city: each venue gets a random city from the built-in pool (unique when possible)
node scripts/seed-business-cards/seed.mjs

# Insert only 5 venues (default 10, max 100)
node scripts/seed-business-cards/seed.mjs --count 5
node scripts/seed-business-cards/seed.mjs --count=3 --type Restaurants --city Almaty

# Only restaurants (DB category + Google Nearby type `restaurant`)
node scripts/seed-business-cards/seed.mjs --type Restaurants --city Almaty

# Full seed: upload images + batch insert
node scripts/seed-business-cards/seed.mjs --city London

# Insert without storage (placeholder image URLs — dev only)
node scripts/seed-business-cards/seed.mjs --skip-images

# Force Unsplash/Picsum even when a Google key is set
node scripts/seed-business-cards/seed.mjs --no-google

# Cap each Google Places photo at 200 KB (default); override or disable
node scripts/seed-business-cards/seed.mjs --google-photo-max-kb 150
node scripts/seed-business-cards/seed.mjs --google-photo-max-kb=0
```

### `--count`

| Flag | Behavior |
|------|----------|
| *(omitted)* | **10** venues (default). |
| `--count 5` | Seed **5** venues; templates cycle if fewer definitions exist for `--type`. |
| `--count=1` | Single venue. |

Allowed range: **1–100**.

### Repeat runs (dedupe)

Before seeding, the script loads existing `business_cards` for the target **city** (and `--type` when set). It skips Google POIs whose **normalized address** (or name+address) is already in the catalogue, shifts search coordinates by `existing count in city + slot index`, and never inserts duplicates within the same run.

### Google photos (strict)

- Storage path: `seed/pixap-demo/places/{google_place_id}/01.jpg` (per POI, not template slug).
- Tracks `photo_reference`, image bytes fingerprint, and public URLs across the run + existing catalogue — no duplicate photos across venues.
- If fewer than 3 unique Google photos are collected → **`images: []`** (no Unsplash/Picsum, no partial reuse).
- `_googlePlace` is cleared between POI attempts so metadata from a previous venue never leaks.
- **`name` / `description` / `name_*` / `description_*`** are generated from the matched Google POI + city + `--type` pool (not static Istanbul/Barcelona template text when `--count` exceeds template pool size).

### `--tags`

Overrides `tags` and all `tags_*` locale columns on **every** seeded row (same list everywhere). Slugs are lowercased; min **3**, max **12** unique tags.

| Form | Example |
|------|---------|
| Comma-separated | `--tags restaurant,fine dining,paris` |
| JSON array | `--tags '["restaurant","luxury","paris"]'` |

PowerShell (comma list — quote the value):

```powershell
node scripts/seed-business-cards/seed.mjs --count 5 --city Paris --tags "restaurant,fine dining,paris"
```

If omitted, tags come from each template in `venues.mjs`.

### City parameter

| Flag | Behavior |
|------|----------|
| `--city Paris` | All **count** venues use **Paris** (preset → `Paris, France`, or Geocoding API for unknown names). |
| `--Istanbul` | Shorthand for `--city Istanbul` (common typos like `--Istambul` are aliased). |
| *(no `--city`)* | Each venue may get a **different** random city; with `--count` > pool size, cities **repeat**. |
| *(omitted)* | **Random** city per venue from: Paris, London, Barcelona, Berlin, Dubai, Istanbul, Lisbon, Miami, Moscow, Tokyo, Amsterdam, Rome, New York. |

Unknown cities require `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` (or `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`) for geocoding.

### Category `--type`

| Flag | Behavior |
|------|----------|
| `--type Restaurants` | Only venues with `category_id` for **Restaurants**; Google search biased to upscale (`fine dining`). |
| `--type Bars` | Bars category, Places type `bar`. |
| *(omitted)* | All 10 mixed templates from `venues.mjs` (default). |

Aliases: display name (`Restaurants`), key (`restaurants`), or photo pool (`restaurant`).  
If fewer templates exist than 10 (e.g. 3 restaurants), the script cycles templates with unique `slug` values.

### Images (Google Places)

When a Maps API key is set and `--skip-images` / `--no-google` are **not** used:

1. **Nearby Search** + **Text Search** around the venue’s `latitude` / `longitude` (≈280–450 m), not a random hit for “{type} in Paris”.
2. Picks the **closest** POI with a real `name` and photos (Place Details if needed).
3. **Place Photo** — download → upload to `business-cards` / `seed/pixap-demo/…`.
4. English `name` in the row comes from the matched Google POI (i18n `name_*` / descriptions stay from `venues.mjs`).
5. `phone` and `contact_whatsapp` from Place Details (`international_phone_number`), normalized to E.164 without spaces or parentheses (e.g. `+77071712020`).

| Flag | Behavior |
|------|----------|
| `--google-photo-max-kb 200` | **Default:** each Places photo must be ≤ 200 KB; script lowers `maxwidth` (1200 → 220) until it fits. |
| `--google-photo-max-kb=0` | No size cap (legacy ~1400px wide download). |
| `--google-photo-max-kb 150` | Custom cap in kilobytes. |

**No stock fallback when a Google key is set** (without `--no-google`):

- If a POI has too few photo references, photos fail the size cap, or Places lookup fails → the venue is **skipped** (`[skip]` log with reason). It is **not** inserted.
- Unsplash/Picsum are only used with `--no-google` or when no API key is configured.

**Restaurants** (`photoPool: restaurant`):

- Text search: `fine dining restaurant`; Nearby keyword: `fine dining`.
- Skips fast food, meal takeaway, bar-only POIs, `price_level` 0–1 ($ / $$), and chain/casual name patterns (McDonald's, brewery, etc.).

Real **address / lat / lng** come from the matched place when lookup succeeds. English `name` from Google; i18n descriptions/tags from `venues.mjs`.

Enable in Google Cloud for the key: **Places API**, **Geocoding API** (for unknown `--city` values). Billing applies per Google pricing.

npm shortcut (optional):

```powershell
npm run seed:business-cards
```

## What it does

1. **`venues.mjs`** — 10 static venue profiles (names, i18n, category, listing type).
2. **`cities.mjs`** — `--city` resolution, random city pool, geo overrides.
3. **`googleMaps.mjs`** — Geocoding, Places Text Search / Details / Photo.
4. **`images.mjs`** — Google-only uploads when API key is set; `googleRestaurantFilter.mjs` for upscale restaurant POIs.
5. **`seed.mjs`** — CLI, orchestration, batch `.insert([...])`.
6. **`validate.mjs`** — Pre-insert: full payload check. Post-insert: compares DB `select('*')` to prepared rows.

## Re-run / cleanup

The script does **not** delete existing rows. To avoid duplicates, remove prior seed rows manually:

```sql
DELETE FROM public.business_cards
WHERE name IN (
  'Anatolian Flame Grill',
  'Barraca Verde Café',
  'Spree Side Taproom',
  'Marina Crown Suites',
  'Thames Core Fitness',
  'Atelier Rose Beauté',
  'LX Factory Hub',
  'Ocean Drive Night Society',
  'Nevsky Smoke Lounge',
  'Shibuya Izakaya Sora'
);
```

Storage objects under `seed/pixap-demo/` can be removed in Dashboard → Storage if needed.

## File map

| File | Role |
|------|------|
| `seed.mjs` | CLI entry, batch insert, orchestration |
| `venues.mjs` | Deterministic venue + i18n data |
| `cities.mjs` | City presets, `--city` / random assignment |
| `googleMaps.mjs` | Geocoding + Places API |
| `images.mjs` | Download + Storage upload + public URLs |
| `validate.mjs` | Row validation |
| `categoryTypes.mjs` | `--type` → `category_id` + Google `photoPool` |
| `lib.mjs` | Env, CLI args, RNG, category IDs, logging |
