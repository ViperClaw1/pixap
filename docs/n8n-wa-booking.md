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
| `N8N_INBOUND_SECRET` | Bearer secret for **inbound** calls to `n8n-wa-booking-callback` (the Node service must use the same value; see below) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Edge Functions.

Legacy `N8N_WA_WEBHOOK_URL` is **no longer** used by `n8n-wa-booking-start`.

## Node service env (`backend/wa-booking-service`)

| Variable | Purpose |
|----------|---------|
| `WA_BOOKING_SUPABASE_CALLBACK_SECRET` | Must match Supabase `N8N_INBOUND_SECRET` when that secret is set; sent as `Authorization: Bearer …` to `n8n-wa-booking-callback`. If Supabase leaves `N8N_INBOUND_SECRET` empty, omit this env. |
| `APP_CALLBACK_URL` | Optional secondary webhook (non-Supabase JSON shape); used only when a booking has **no** `supabase_callback_*` fields |
| `PORT` | Listen port (default `8081`) |

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
**Headers:** `Authorization: Bearer <N8N_INBOUND_SECRET>` (if secret is set on Supabase)  
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

JWT verification is **disabled** for this function (server-to-server); only the Bearer secret is accepted when `N8N_INBOUND_SECRET` is set.

## WhatsApp inbound

Configure your WhatsApp provider (e.g. Meta) to `POST` owner replies to the Node service:

- `POST {your-service}/webhook/whatsapp`
- JSON body: `{ "from": "<owner_phone>", "message": "<text>" }`

Phone matching uses the same string as `owner_phone` on the booking (normalize consistently in production).

## Realtime

Optionally enable Postgres **Realtime** on `public.cart_items` so the app updates as soon as the callback writes status lines. Otherwise the client polls every few seconds while a flow is in progress.

## Database

Migration `20260416_cart_items_wa_n8n.sql` adds `wa_*` columns on `cart_items`. Apply migrations before deploying functions.

## Troubleshooting `n8n-wa-booking-start` (non-2xx)

The Expo log line `Edge Function returned a non-2xx status code` is generic. After redeploying the function, the app console should append details from the function JSON body (e.g. `wa_booking_service_failed`, `wa_booking_status`, `hint`).

| Symptom | Likely cause |
|--------|----------------|
| `step: "db_select"` / missing column | Migration not applied on the Supabase project used by the app. |
| `WA_BOOKING_SERVICE_URL is not set` | Secret missing or typo in the Dashboard. |
| `wa_booking_status: 404` | Wrong `WA_BOOKING_SERVICE_URL` or Node service not deployed / path not `/webhook/booking`. |
| `Unauthorized` on **start** | User session not passed to `invoke`. |
| **401 before function runs** (short response, no `[step]` in app logs) | Supabase **API gateway** `verify_jwt` rejecting valid **ES256** session JWTs; this repo sets **`verify_jwt = false`** for `n8n-wa-booking-start` in [`supabase/config.toml`](../supabase/config.toml). Redeploy or disable **Verify JWT** in Dashboard for this function. |

### Callback auth (optional)

If **`N8N_INBOUND_SECRET`** is unset or empty, `n8n-wa-booking-callback` accepts requests **without** `Authorization`. Set a strong secret in production and configure `WA_BOOKING_SUPABASE_CALLBACK_SECRET` on the Node service to match.
