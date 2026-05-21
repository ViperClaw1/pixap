# Supabase Image Transformations (P0.1)

## Checklist

| Step | Where | Status |
|------|--------|--------|
| Pro plan | [Dashboard → Billing](https://supabase.com/dashboard/org/_/billing) | Done |
| Image Transformations | Project → **Storage** → **Image Transformations** | Done |
| App env | `EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM=1` | Done |
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
# EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM=1 is already in .env.example
npx expo start -c
```

EAS builds (`development` / `preview` / `production`) inject `EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM=1` via `eas.json`.

## App behavior

- **Flag on + transforms on:** URLs use `/storage/v1/render/image/public/...?width=&quality=` → smaller cached egress.
- **Flag on + transforms off (403):** `SmartImage` retries `/object/public/` automatically (full file; no broken UI).
- **Flag off:** always `/object/public/` (legacy).

## Verify in the app

1. Open feed — images load (Network: render URLs when transforms work).
2. Open chat with photo attachment — thumb uses render when available.

Project render URL pattern:

```
https://ylcyktbppowabnxuwdrr.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=720&quality=76
```
