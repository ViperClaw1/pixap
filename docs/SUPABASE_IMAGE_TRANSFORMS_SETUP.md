# Supabase Image Transformations (P0.1)

## Checklist

| Step | Where | Status |
|------|--------|--------|
| Pro plan | [Dashboard → Billing](https://supabase.com/dashboard/org/_/billing) | Done |
| Image Transformations | Project → **Storage** → **Image Transformations** | Done |
| App env | `EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM=1` | Done |
| Pregen audit | `supabase/smoke/storage_pregen_missing_audit.sql` | Run weekly |
| Smoke test | `.\scripts\smoke-supabase-image-transform.ps1` | **200** |

## Dashboard (обязательно)

1. Upgrade organization to **Pro** ($25/mo) if still on Free.
2. Open project **pix** (`ylcyktbppowabnxuwdrr`).
3. **Project Settings** → **Storage** (or Storage section) → turn on **Image Transformations**.
4. Run smoke script (expect **200**, not **403**):

   ```powershell
   .\scripts\smoke-supabase-image-transform.ps1
   ```

## Local dev

```bash
cp .env.example .env
# Set EXPO_PUBLIC_SUPABASE_URL / ANON_KEY from Dashboard → API
# EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM=1 matches EAS builds
npx expo start -c
```

EAS builds (`development` / `preview` / `production`) read `EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM=1` from **EAS Environment** (expo.dev → Project → Environment variables). Do not duplicate it in `eas.json` when already set there.

## App behavior (pregen-first)

1. **Primary:** pre-generated `*_thumb.webp`, `*_hero.webp`, `*_gallery.webp` (business-cards), `*_feed.webp` / `*_story.webp` (stories), avatar `*_thumb.webp` — served via `/object/public/` (**no transform quota**).
2. **Fallback (flag `1`):** if pregen is missing or fails to load, `getOptimizedImageUrl` uses `/render/image/` (counts toward transform quota).
3. **403 on render:** `SmartImage` retries `/object/public/` original automatically.

Run pregen audit before production releases:

```bash
supabase db query --file supabase/smoke/storage_pregen_missing_audit.sql
```

Backfill missing variants:

```bash
node scripts/backfill-business-card-pregen.mjs --dry-run
node scripts/backfill-stories-pregen.mjs --dry-run
```

## Verify in the app

1. Open feed — Network tab should show `/object/public/.../_feed.webp` or `/_story.webp` for most media.
2. `/render/image/` should be rare (legacy content only).
3. Dev Metro: `[storage-egress]` — `renderSharePercent` should stay low.

Project render URL pattern (fallback only):

```
https://ylcyktbppowabnxuwdrr.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=720&quality=76
```
