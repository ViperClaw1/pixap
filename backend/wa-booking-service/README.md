# Deterministic WhatsApp Booking Service

Standalone Express backend that handles deterministic (non-AI) WhatsApp booking confirmation.

## Run

1. Install dependencies:

   `npm install`

2. Start service:

   `npm run start`

3. Development mode:

   `npm run dev`

Service listens on **port 8081** by default. If that port is already in use and you did **not** set `PORT`, the server automatically tries **8082, 8083, …** until one is free (watch the log for the actual port). If you set `PORT` explicitly and it is busy, the process exits with a clear error.

## Railway / containers

- The server binds to **`0.0.0.0`** by default so the platform proxy can reach it (binding only to `localhost` often causes **“Application failed to respond”**). Override with `LISTEN_HOST` if needed.
- **Service root directory** in Railway must be **`backend/wa-booking-service`** (single hyphen: `wa-booking-service`). A typo like `wa-booking--service` points at a non-existent folder.
- **Custom domain “Application failed to respond”** while deploy logs show the app running: in Railway **Networking → your domain → target port** must match the **`PORT`** value Railway injects (see deploy logs, often `8080`). Domains previously used with Expo often had target port **8081**; this service also opens **8081** on Railway when `PORT` is not 8081 so those domains keep working. Prefer fixing the target port in the dashboard, then set **`RAILWAY_EXTRA_LISTEN_8081=0`**.
- Config file path from repo root: **`/backend/wa-booking-service/railway.toml`**. `railway.toml` sets `healthcheckPath = "/health"` and `startCommand`.

## Environment variables

- `PORT` (optional): default `8081` — on Railway, **do not** override; the platform sets `PORT` for you.
- `LISTEN_HOST` (optional): default `0.0.0.0`
- `RAILWAY_EXTRA_LISTEN_8081` (optional): on Railway, when `PORT` is not `8081`, the app also listens on **8081** unless this is `0` or `false` (fixes custom domains whose internal target port is still **8081**).
- `WA_BOOKING_SUPABASE_CALLBACK_SECRET` (recommended in production): Bearer token sent to Supabase `n8n-wa-booking-callback`; must match Supabase secret `N8N_INBOUND_SECRET` when that is set
- `APP_CALLBACK_URL` (optional): default `https://example.com/api/update-booking` — used only for bookings **without** `supabase_callback_url` / `supabase_callback_token` in the POST body
- `APP_NOTIFY_RETRIES` (optional): default `3`
- `APP_NOTIFY_TIMEOUT_MS` (optional): default `5000`

## Endpoints

- `POST /webhook/booking`
- `POST /webhook/whatsapp`
- `GET /health`
- `GET /debug/state` (for local verification)

## Conversation state machine

- `availability`:
  - `NO` => booking rejected and completed
  - `YES` => move to `pricing`
  - unclear => reprompt YES/NO
- `pricing`:
  - `YES` => confirmed free (`price=0`) and completed
  - `NO` => move to `pricing_price_input`
  - unclear => reprompt YES/NO
- `pricing_price_input`:
  - valid number => confirmed with price and completed
  - invalid => reprompt for numeric price
