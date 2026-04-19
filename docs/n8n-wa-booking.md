# WhatsApp venue booking (deterministic service)

Service cart items trigger the Supabase Edge Function `n8n-wa-booking-start`, which forwards the booking to the **deterministic Node service** at `backend/wa-booking-service` (no n8n, no AI). That service messages the venue owner (`owner_phone` = `business_cards.contact_whatsapp`) and updates the app via the existing Supabase function `n8n-wa-booking-callback`.

## Architecture

1. App → `n8n-wa-booking-start` (authenticated) with `{ cart_item_id }`.
2. Edge function → `POST {WA_BOOKING_SERVICE_URL}/webhook/booking` with booking fields + Supabase callback metadata.
3. Node service → mock/real WhatsApp out; venue replies hit `POST /webhook/whatsapp` on the same service.
4. Node service → `POST …/functions/v1/n8n-wa-booking-callback` with `status_lines` / `confirmable` / optional `confirmed_price`.

## Supabase secrets (Edge)

| Secret | Purpose |
|--------|---------|
| `WA_BOOKING_SERVICE_URL` | Base URL of the Node service (e.g. `https://wa-bookings.example.com`) **or** full `…/webhook/booking` URL |
| `N8N_INBOUND_SECRET` | Shared secret for **inbound** calls to `n8n-wa-booking-callback`; the Node service sends it as **`x-wa-booking-secret`** (must match this value). |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Edge Functions.

Legacy `N8N_WA_WEBHOOK_URL` is **no longer** used by `n8n-wa-booking-start`.

## Node service env (`backend/wa-booking-service`)

| Variable | Purpose |
|----------|---------|
| `WA_BOOKING_SUPABASE_CALLBACK_SECRET` | Must match Supabase `N8N_INBOUND_SECRET` when set; sent as **`x-wa-booking-secret`** to `n8n-wa-booking-callback`. Omit if `N8N_INBOUND_SECRET` is unset. |
| `SUPABASE_ANON_KEY` | Project **anon** key (**required** on Railway unless `SUPABASE_SERVICE_ROLE_KEY` is set). Used for `apikey` + `Authorization` on **`POST …supabase.co/functions/v1/…`** so the gateway does not return **`UNAUTHORIZED_NO_AUTH_HEADER`**. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional **fallback** on the Node service only: same value as in Supabase dashboard; used if `SUPABASE_ANON_KEY` is missing. Prefer anon for least privilege. |
| `APP_CALLBACK_URL` | Optional secondary webhook (non-Supabase JSON shape); used only when a booking has **no** `supabase_callback_*` fields |
| `PORT` | Listen port (default **8787** locally; avoids Expo Metro on **8081**. Railway sets `PORT` automatically.) |

## Outbound payload (`n8n-wa-booking-start` → Node `POST /webhook/booking`)

The app invokes `n8n-wa-booking-start` with `{ cart_item_id }` after a cart row is shown on the Services tab (when the venue has `contact_whatsapp`). The function POSTs JSON like:

```json
{
  "booking_id": "<cart_items.id>",
  "venue_name": "…",
  "date": "2026-04-18",
  "time": "14:30",
  "owner_phone": "<digits or E.164>",
  "user_id": "<auth uuid>",
  "venue_id": "<business_cards.id>",
  "supabase_callback_url": "https://<project-ref>.supabase.co/functions/v1/n8n-wa-booking-callback",
  "supabase_callback_token": "<uuid>"
}
```

Idempotent: if `wa_n8n_started_at` is already set for the cart row, the function returns `{ ok: true, already_started: true }` and does not call the Node service again.

## Inbound callback (Node → `n8n-wa-booking-callback`)

**URL:** `https://<project-ref>.supabase.co/functions/v1/n8n-wa-booking-callback`  
**Method:** `POST`  
**Headers (hosted Supabase):** the API gateway requires a **valid JWT** on `Authorization` (use **`Bearer <SUPABASE_ANON_KEY>`**) and the **`apikey`** header (same anon key). If **`N8N_INBOUND_SECRET`** is set, also send **`x-wa-booking-secret: <same value>`** — do **not** put the inbound secret alone in `Authorization` (it is not a JWT and triggers `UNAUTHORIZED_INVALID_JWT_FORMAT`). The Node service does this automatically when **`SUPABASE_ANON_KEY`** and **`WA_BOOKING_SUPABASE_CALLBACK_SECRET`** are set on Railway.  
**Content-Type:** `application/json`

**Body:**

```json
{
  "callback_token": "<same uuid as outbound>",
  "status_lines": [
    "Message sent to venue.",
    "Waiting for availability…"
  ],
  "confirmable": false,
  "confirmed_slot": null,
  "confirmed_price": "$25"
}
```

- `status_lines` must be a **JSON array of strings** (replaces the previous list in the UI).
- Set **`confirmable`: `true`** only when the user is allowed to tap **Confirm** in the app (after price is finalized: free `0` or paid number).
- `confirmed_slot` / `confirmed_price` are optional; if `confirmed_price` is parseable as a number, **Confirm** uses it as the booking `cost`.

JWT verification is **disabled** for this function in [`supabase/config.toml`](../supabase/config.toml); when `N8N_INBOUND_SECRET` is set, the function checks **`x-wa-booking-secret`** (preferred) or legacy **`Authorization: Bearer <secret>`** (only works if your gateway does not require a JWT).

## WhatsApp inbound

Configure your WhatsApp provider (e.g. Meta) on **`{your-service}/webhook/whatsapp`**:

- **Meta / WhatsApp Cloud API** sends a **GET** first with `hub.mode`, `hub.verify_token`, `hub.challenge` ([verification](https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests)). Set **`META_WEBHOOK_VERIFY_TOKEN`** on the Node service (Railway) to the **same** string as Meta’s “Verify token” field. A matching request returns **200** and the raw `hub.challenge` body.
- **POST** events: Meta posts to the same callback URL. This repo’s handler expects a simplified JSON shape: `{ "from": "<owner_phone>", "message": "<text>" }` (you may need a small adapter if Meta’s payload differs).

`GET /webhook/booking` also answers Meta’s verification handshake (same token env) so a mis-pasted Meta URL can still verify; **POST** booking traffic for the app remains **`/webhook/booking`** from Supabase only.

Phone matching uses the same string as `owner_phone` on the booking (normalize consistently in production).

## Realtime

Optionally enable Postgres **Realtime** on `public.cart_items` so the app updates as soon as the callback writes status lines. Otherwise the client polls every few seconds while a flow is in progress.

## Database

Migration `20260416_cart_items_wa_n8n.sql` adds `wa_*` columns on `cart_items`. Apply migrations before deploying functions.

## Deploy / refresh the Edge function

Production must run the **current** `n8n-wa-booking-start` code (it calls **`WA_BOOKING_SERVICE_URL`** only; it does **not** call n8n). From the repo root, with the Supabase CLI logged in and project linked:

```bash
supabase link --project-ref <your-project-ref>
supabase functions deploy n8n-wa-booking-start
```

Or pass the ref without linking: `supabase functions deploy n8n-wa-booking-start --project-ref <your-project-ref>`.

After deploy, function logs should mention **`wa_booking_upstream`** on upstream errors — if you still see **`n8n_upstream`**, the hosted bundle is an old build.

## Troubleshooting `n8n-wa-booking-start` (non-2xx)

The Expo log line `Edge Function returned a non-2xx status code` is generic. After redeploying the function, the app console should append details from the function JSON body (e.g. `wa_booking_service_failed`, `wa_booking_status`, `hint`).

| Symptom | Likely cause |
|--------|----------------|
| Log **`n8n_upstream` 404** and JSON like *"The requested webhook … is not registered"* (n8n / test-mode hint) | **Stale deployment:** Supabase is still running an **old** `n8n-wa-booking-start` that posted to **n8n**. Redeploy this function from the repo (see above). Set secret **`WA_BOOKING_SERVICE_URL`** to your `wa-booking-service` HTTPS base (e.g. `https://api.pixapp.kz`). |
| `step: "db_select"` / missing column | Migration not applied on the Supabase project used by the app. |
| `WA_BOOKING_SERVICE_URL is not set` | Secret missing or typo in the Dashboard. |
| `wa_booking_status: 404` | Wrong `WA_BOOKING_SERVICE_URL` or Node service not deployed / path not `/webhook/booking`. |
| `Unauthorized` on **start** | User session not passed to `invoke`. |
| **401 before function runs** (short response, no `[step]` in app logs) | Supabase **API gateway** `verify_jwt` rejecting valid **ES256** session JWTs; this repo sets **`verify_jwt = false`** for `n8n-wa-booking-start` in [`supabase/config.toml`](../supabase/config.toml). Redeploy or disable **Verify JWT** in Dashboard for this function. |

### Callback auth (optional)

If **`N8N_INBOUND_SECRET`** is unset or empty, `n8n-wa-booking-callback` does not check the shared secret. For production, set **`N8N_INBOUND_SECRET`** in Supabase and **`WA_BOOKING_SUPABASE_CALLBACK_SECRET`** + **`SUPABASE_ANON_KEY`** on the Node service (same secret values as in this doc).

| Symptom | Likely cause |
|--------|----------------|
| **`UNAUTHORIZED_INVALID_JWT_FORMAT`** on callback | Node sent **`Authorization: Bearer <random secret>`** only. Add **`SUPABASE_ANON_KEY`** on Railway and redeploy Node; use **`x-wa-booking-secret`** for the inbound secret (handled in current code). Redeploy **`n8n-wa-booking-callback`** if it predates `x-wa-booking-secret` support. |
| **`UNAUTHORIZED_NO_AUTH_HEADER`** on callback | **`SUPABASE_ANON_KEY`** (or **`SUPABASE_SERVICE_ROLE_KEY`** fallback) is **not** set on Railway, so `fetch` sends no gateway JWT. Set one of them and redeploy **`wa-booking-service`**. |
