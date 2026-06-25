# Deterministic WhatsApp Booking Service

Standalone Express backend that handles deterministic (non-AI) WhatsApp booking confirmation.

## Retell voice agent config

The Retell agent's system prompt and post-call analysis schema live in `retell/` and are the source of truth:

- `retell/agent.prompt.txt` — full system prompt (includes IVR navigation instructions)
- `retell/post-call-analysis.json` — post-call analysis schema (outcome enum: CONFIRMED / DECLINED / ALTERNATIVE_OFFERED / IVR_NAVIGATION_FAILED / UNCLEAR)

To push local config to Retell, add `RETELL_API_KEY` and `RETELL_AGENT_ID` to the root `.env` file, then:
```powershell
npm run retell:sync:dry   # dry-run — shows diff without writing
npm run retell:sync       # apply changes
```

Or inline in PowerShell without touching `.env`:
```powershell
$env:RETELL_API_KEY="key"; $env:RETELL_AGENT_ID="agent_xxx"; npm run retell:sync:dry
```

The script enables `enable_voicemail_detection` and `enable_ivr_navigation` on the agent if not already set.

## Run

1. Install dependencies:

   `npm install`

2. Start service:

   `npm run start`

3. Development mode:

   `npm run dev`

Service listens on **port 8787** by default (avoids **8081**, which Expo Metro uses). If that port is busy and you did **not** set `PORT`, the server tries **8788, 8789, …** until one is free (watch the log). If you set `PORT` explicitly and it is busy, the process exits with a clear error.

## Railway / containers

- The server binds to **`0.0.0.0`** by default so the platform proxy can reach it (binding only to `localhost` often causes **“Application failed to respond”**). Override with `LISTEN_HOST` if needed.
- **Service root directory** in Railway must be **`backend/wa-booking-service`** (single hyphen: `wa-booking-service`). A typo like `wa-booking--service` points at a non-existent folder.
- **Custom domain “Application failed to respond”** while deploy logs show the app running: in Railway **Networking → your domain → target port** must match the **`PORT`** value Railway injects (see deploy logs, often `8080`). Domains previously used with Expo often had target port **8081**; this service also opens **8081** on Railway when `PORT` is not 8081 so those domains keep working. Prefer fixing the target port in the dashboard, then set **`RAILWAY_EXTRA_LISTEN_8081=0`**.
- Config file path from repo root: **`/backend/wa-booking-service/railway.toml`**. `railway.toml` sets `healthcheckPath = "/health"` and `startCommand`.

## Environment variables

- `PORT` (optional): default **8787** locally — on Railway, **do not** override; the platform sets `PORT` for you.
- `LISTEN_HOST` (optional): default `0.0.0.0`
- `RAILWAY_EXTRA_LISTEN_8081` (optional): on Railway, when `PORT` is not `8081`, the app also listens on **8081** unless this is `0` or `false` (fixes custom domains whose internal target port is still **8081**).
- `WA_BOOKING_SUPABASE_CALLBACK_SECRET` (recommended in production): must match Supabase **`N8N_INBOUND_SECRET`** when set; sent as header **`x-wa-booking-secret`** to `n8n-wa-booking-callback` (not as `Authorization`, because Supabase’s gateway requires a JWT there).
- `SUPABASE_ANON_KEY` or **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** (**required** for hosted **`…supabase.co/functions/v1/n8n-wa-booking-callback`**): same project **anon** JWT; used for **`apikey`** + **`Authorization`** so the gateway does not return `UNAUTHORIZED_NO_AUTH_HEADER`. Railway often only defines the `EXPO_PUBLIC_*` name — that is enough. Copy from Supabase → Project Settings → API.
- `WHATSAPP_PHONE_NUMBER_ID` (**required** to send outbound messages): WhatsApp Cloud API Phone Number ID from Meta.
- `WHATSAPP_ACCESS_TOKEN` (**required** to send outbound messages): permanent/system user token with `whatsapp_business_messaging`.
- `WHATSAPP_GRAPH_VERSION` (optional): default `v22.0`.
- `WHATSAPP_GRAPH_BASE_URL` (optional): default `https://graph.facebook.com`.
- `WHATSAPP_TEMPLATE_LANGUAGE` (optional): default `en` — Meta `language.code` for **all** flow templates (`*_rus` and `*_eng`). Suffix `_rus` / `_eng` only picks the template **name**, not the language.
- `WHATSAPP_TEMPLATE_LANGUAGE_EN` / `WHATSAPP_TEMPLATE_LANGUAGE_RU` (optional): per-suffix overrides; usually leave unset so both chains use `WHATSAPP_TEMPLATE_LANGUAGE`.
- **`WHATSAPP_HEADER_LOGO_URL`** (**required** for the default flow): one **public HTTPS** JPG/PNG used as the dynamic header image for **all** flow templates (`check_availability_*`, `check_price_*`, `confirm_*`). Same logo in Meta for each template → one env var is enough.
- Per-template overrides (optional): `WHATSAPP_TEMPLATE_<TEMPLATE_NAME>_HEADER_IMAGE_URL`, e.g. `WHATSAPP_TEMPLATE_GOT_IT_EN_HEADER_IMAGE_URL`, or legacy `WHATSAPP_CHECK_IS_AVAILABLE_EN_HEADER_IMAGE_URL`, `WHATSAPP_GOT_IT_RU_HEADER_IMAGE_URL`, etc.
- **Supabase Storage:** URL must be **`.../storage/v1/object/public/<bucket>/<path>`** (bucket public). Private `/object/<bucket>/...` URLs are auto-rewritten to `/object/public/...` when possible; signed URLs cannot be fixed — use public path or another CDN.
- **`WHATSAPP_FLOW_TEMPLATES_STATIC_HEADER=1`**: only if **every** flow template uses a **static** header in Meta (no dynamic image) — then header URLs are optional again.
- `WHATSAPP_SKIP_HEADER_IMAGE_VERIFY=1`: skip preflight HEAD/GET (not recommended in production).
- `APP_CALLBACK_URL` (optional): default `https://example.com/api/update-booking` — used only for bookings **without** `supabase_callback_url` / `supabase_callback_token` in the POST body
- `APP_NOTIFY_RETRIES` (optional): default `3`
- `APP_NOTIFY_TIMEOUT_MS` (optional): default `5000`
- `META_WEBHOOK_VERIFY_TOKEN` (recommended for Meta / WhatsApp Cloud API): must match the **Verify token** you enter in the Meta developer app when subscribing the webhook. Alternate env name: `WHATSAPP_VERIFY_TOKEN`.

## Endpoints

- `POST /webhook/booking` — Supabase `n8n-wa-booking-start` → JSON booking payload. Plain GET (no `hub.*` params) returns **405** + hint.
- `POST /webhook/whatsapp` — inbound WhatsApp / owner replies (JSON). **Preferred Meta webhook URL** for GET verify + POST events.
- **Meta GET verification** ([docs](https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests)): on **`GET /webhook/whatsapp`** and **`GET /webhook/booking`**, if `hub.mode=subscribe` and `hub.verify_token` matches `META_WEBHOOK_VERIFY_TOKEN`, the server responds **200** with plain-text `hub.challenge`. Use the **same** verify token string in Meta’s field and in Railway/env.
- In Meta’s Webhooks UI, turn **off** “Attach client certificate” unless you intentionally use mTLS (otherwise verification can fail).
- `GET /health`
- `GET /debug/state` (for local verification)

## Conversation state machine

Template chain (`_rus` / `_eng`) is chosen from **`owner_phone`** (`business_cards.contact_whatsapp`), **not** the app UI language:

- **`+7…` or `+37…`** (also digits starting with `7` / `37`) → `check_availability_rus` → `check_price_rus` → `confirm_rus`
- **All other numbers** → `check_availability_eng` → `check_price_eng` → `confirm_eng`

`interface_locale` in the POST body from Supabase is logged as `app_interface_locale` only; it does not affect templates.

Price replies from the owner are parsed with case-insensitive ISO codes (`USD`, `RUB`, `EUR`, `AMD`, `KZT`, …) plus localized words (руб, тенге, драм, etc.).

| Step | Outbound template | Owner reply |
|------|-------------------|-------------|
| `availability` | `check_availability_{eng\|rus}` | Quick reply: available / not available |
| `pricing` | `check_price_{eng\|rus}` | Free / send price |
| `pricing_price_input` | (text prompt) | Price + currency in free text |
| complete | `confirm_{eng\|rus}` | — |

### `Message undeliverable` (delivery webhook `failed`)

When Meta cannot deliver to the venue number (not on WhatsApp, invalid number, etc.), `wa-booking-service` writes clear lines to `wa_status_lines`, sets `wa_confirmable` to `false`, and stops the active conversation for that booking. The app shows these lines in Cart (orange) and disables Confirm.

### Meta error `#132001` — template name does not exist in the translation

The API request uses **exact** `template.name` (e.g. `check_availability_rus`) and `template.language.code` (default `en` from `WHATSAPP_TEMPLATE_LANGUAGE`). Both must match what is **approved** in WhatsApp Manager for this WABA:

1. Template **name** in Meta equals the full string (`check_availability_rus`, not `check_is_available_ru`).
2. Template **language** in Meta matches `WHATSAPP_TEMPLATE_LANGUAGE` (e.g. `en`). The `_rus` suffix is for phone-based template **selection**, not Russian locale in Meta.
3. Status is **Approved** (not Draft / Rejected).

`GET /health` returns `flow_templates.sequence_by_locale`, `shared_header_logo_url`, resolved URL per template, and `header_image_checks`.

### `header_image_precheck_failed` or `Media upload error`

1. Set **`WHATSAPP_HEADER_LOGO_URL`** to a working public image URL (test in browser — must show the image, not JSON).
2. If using Supabase, copy the **public** object URL from Storage (or make the bucket public).
3. Remove broken per-template vars that override the shared logo with an invalid Supabase private URL.
4. Redeploy and call `GET /health` — every entry in `header_image_checks` should have `"ok": true`.

On completion the service sets `confirmable: true` with `confirmed_price` (`0` or parsed price). Payment-link templates are no longer used.
