# API reference

Edge Functions, `wa-booking-service`, and configuration. Back to [README](../README.md).

## Edge Function auth (`verify_jwt = false`)

Gateway JWT checks are off for these (ES256 session tokens can 401 at the gateway, see supabase/supabase#44530). Each function authenticates itself:

| Function | Caller | Auth mechanism |
| --- | --- | --- |
| `lemon-webhook` | Lemon Squeezy | HMAC-SHA256 of the body with `LEMONSQUEEZY_SIGNING_SECRET` |
| `n8n-wa-booking-callback` | `wa-booking-service` / n8n | Shared secret `N8N_INBOUND_SECRET` in `x-wa-booking-secret` (or Bearer). Returns 503 if the secret is unset |
| `n8n-wa-booking-start` | App | User JWT via `auth.getUser()` |
| `confirm-service-cart-booking` | App | User JWT via `auth.getUser()` |
| `pixai-booking-chat` | App | User JWT via `auth.getUser()` |
| `auth-email-signup` | App (pre-auth) | None, public by design. Input validation only |
| `auth-email-recovery` | App (pre-auth) | None, public by design. Input validation only |
| `iap-apple-notifications` | App Store Server Notifications v2 | Apple JWS signature chain (`verifyAppleSignedPayload`) |
| `iap-google-rtdn` | Google Pub/Sub push | Pub/Sub OIDC token (`verifyGooglePubSubRequest`) |
| `iap-reconcile-subscriptions` | pg_cron | Bearer = service role key or `IAP_RECONCILIATION_SECRET` |
| `consume-push-outbox` | pg_cron | `x-push-cron-secret` = `PUSH_CRON_SECRET`, or service role bearer |
| `generate-daily-recommendations` | pg_cron | Service role bearer (`_shared/serviceAuth.ts`) |
| `send-booking-email` | pg_net trigger / cron | Service role bearer (`_shared/serviceAuth.ts`) |
| `booking-reminder-cron` | pg_cron | Service role bearer (`_shared/serviceAuth.ts`) |
| `link-router` | Browsers (deep links) | None, public redirect |
| `transcribe-audio` | App | ⚠️ None. The client sends only the anon key, so this is an open Groq proxy. Needs a user JWT check plus a client change |

`wa-booking-service` (Express) verifies Meta `X-Hub-Signature-256` with `META_APP_SECRET` (it fails closed when the secret is unset) and dedupes inbound messages by `message.id`.


## Endpoints

Unless noted, **base URL** for Edge Functions is:

`{SUPABASE_URL}/functions/v1/{function-name}`

Send **`Authorization: Bearer <user_access_token>`** for user-scoped functions. For **`verify_jwt = false`** functions, follow each section: some require **service secrets**, **HMAC signatures**, or **anon JWT + custom header**.

### Mobile-invoked Edge Functions (from codebase)

| Function | Method | Auth | Request body (JSON) | Response (typical) |
|----------|--------|------|---------------------|-------------------|
| **`pixai-orchestrate`** | POST | User JWT (gateway) | `{ flow: { city, mode: "nearby"\|"city", categoryId?, categoryName?, isRestaurantTable?, comment?, radiusMiles?, location?: {lat,lng}, limit? } }` | `{ assistant, places[], slots[] }` |
| **`pixai-booking-chat`** | POST | User JWT (gateway) or **verify_jwt false** + inner `auth.getUser()` (match repo config) | `{ booking_context, places: [...], messages: [...], user_message }` | `{ message, filters, rerankedPlaceIds[], excludedPlaceIds[], explanation? }` — secret **`GEMINI_API_KEY`**; optional **`GEMINI_MODEL`** (one id tried first). If that model returns 404/403, the function tries a built-in fallback chain (`gemini-2.5-flash`, `gemini-3-flash-preview`, …). Without API key, returns a safe no-op JSON. |
| **`get-available-slots`** | POST | User JWT | `{ business_id, date? }` | `{ slots: [{ label, dateTimeIso, available, isBest }] }` |
| **`n8n-wa-booking-start`** | POST | Bearer JWT in `Authorization` header (client passes it explicitly in some screens) | `{ cart_item_id }` | `{ ok, callback_token, already_started? }` or structured errors (`step`, `hint`) |
| **`confirm-service-cart-booking`** | POST | Bearer JWT | `{ cart_item_id, action?: "confirm"\|"pay" }` | `{ ok: true, booking_id }` or `{ error }` |
| **`iap-verify-purchase`** | POST | User JWT via invoke | Platform-specific purchase fields (`platform`, `productId`, transaction ids / receipt / `purchaseToken`, `source`, &) | Entitlement / error payload per implementation |
| **`iap-sync-status`** | POST | User JWT | (empty or ignored) | `{ entitlement: {...} \| null }` |

### Other Edge Functions (server / secondary clients)

| Function | Purpose | Notes |
|----------|---------|--------|
| **`create-booking-draft`** | Inserts a **`cart_items`** draft with `status: "created"` using service fields from body | Authenticated user JWT; alternative path to direct client `insert`. |
| **`search-businesses`** | Scored search over `business_cards` | Authenticated user JWT; optional `query`, `city`, `limit`, `preference_tags`. |
| **`lemon-create-checkout`** | Creates Lemon checkout | User JWT + Lemon API keys. |
| **`lemon-webhook`** | Lemon `order_created` | **verify_jwt false**; `X-Signature` HMAC. |
| **`n8n-wa-booking-callback`** | Updates `cart_items` from WA service | **verify_jwt false**; `N8N_INBOUND_SECRET` in `Authorization` **or** `x-wa-booking-secret`; for hosted Supabase, WA service uses **anon JWT** in `Authorization` + secret header. |
| **`n8n-wa-booking-start`** | Starts WA flow | **verify_jwt false**; validates JWT **inside** with anon client + `auth.getUser()`. |
| **`confirm-service-cart-booking`** | Confirms booking after WA | **verify_jwt false**; same inner JWT pattern. |
| **`iap-apple-notifications`** | Apple ASSN v2 | **verify_jwt false**; POST signed payloads from Apple. |
| **`iap-google-rtdn`** | Google Play RTDN | **verify_jwt false**; Pub/Sub style envelope. |

### `wa-booking-service` HTTP API

Base: your deployed origin (e.g. Railway). Mount path **`/webhook`**.

| Endpoint | Method | Description |
|----------|--------|-------------|
| **`/webhook/booking`** | POST | Primary: **Supabase booking start** JSON (`booking_id`, `venue_name`, `date`, `time`, `owner_phone`, optional `supabase_callback_url` + `supabase_callback_token`, customer fields, &). **Also** accepts simplified `{ from, message }` or Meta **`entry[]`** shape for WhatsApp routing (see service). Returns **`202`** `{ ok, booking }` for create path. |
| **`/webhook/booking`** | GET | Meta **hub challenge** verification when `hub.verify_token` matches env. |
| **`/webhook/whatsapp`** (and **`/`** under webhook router) | GET | Same Meta verification (preferred Meta callback URL). |
| **`/webhook/whatsapp`** | POST | Inbound WhatsApp (Meta or simplified JSON). |
| **`/health`** | GET | Liveness + minimal config fingerprint. |
| **`/debug/state`** | GET | In-memory booking debug snapshot. |

Detailed state machine: [backend/wa-booking-service/README.md](../backend/wa-booking-service/README.md).

---

## Configuration and environment

### Mobile (`/.env`  see [.env.example](../.env.example))

- **`EXPO_PUBLIC_SUPABASE_URL`**, **`EXPO_PUBLIC_SUPABASE_ANON_KEY`**: Required.
- **`EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM`**: Set to `1` in **EAS Environment** (and locally in `.env`) so `/render/image/` is used only when pregen WebP is missing; primary path is pre-generated variants via `/object/public/` (see `SUPABASE_IMAGE_TRANSFORMS_SETUP.md`).
- **`EXPO_PUBLIC_OAUTH_REDIRECT_BASE`**: HTTPS site for email / reset links.
- **`EXPO_PUBLIC_OAUTH_MOBILE_REDIRECT_URI`**: Optional override for native OAuth redirect.
- **`EXPO_PUBLIC_STRIPE_RETURN_SCHEME`**: Deep link scheme segment for payment return (see `app.config.ts` **`scheme`**: **`pixap`**).
- **`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`**, **`EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY`**: Maps + REST.
- **`EXPO_PUBLIC_PIXAPP_API_URL`**: Optional reverse proxy base (e.g. Lemon routes).
- **`EXPO_PUBLIC_PIXAI_MONTHLY_SUBSCRIPTION_SKU`**: Store SKU for PixAI Premium Monthly (`pixai_premium_monthly`, 10 booking credits per cycle).
- **`EXPO_PUBLIC_PIXAI_ANNUAL_SUBSCRIPTION_SKU`**: Store SKU for PixAI Premium Plus Annual (`pixai_premium_annual`, 100 booking credits per cycle).
- **`EXPO_PUBLIC_PIXAI_WHATSAPP_E164`**: Digits-only fallback for PixAI WhatsApp CTAs.
- **`EXPO_PUBLIC_EAS_PROJECT_ID`**: EAS / push-related.

Build-time: `app.config.ts` also reads **`APP_VERSION`**, **`IOS_BUILD_NUMBER`**, **`ANDROID_VERSION_CODE`**.

### Supabase Edge secrets (Dashboard)

Documented in [.env.example](../.env.example) and in each functions source; commonly:

- **`SUPABASE_SERVICE_ROLE_KEY`**, **`SUPABASE_URL`**, **`SUPABASE_ANON_KEY`**
- **`WA_BOOKING_SERVICE_URL`**: Public base URL for `n8n-wa-booking-start` � **`wa-booking-service`**
- **`N8N_INBOUND_SECRET`**: Shared with **`WA_BOOKING_SUPABASE_CALLBACK_SECRET`** on the Node service
- **Lemon**, **Apple**, **Google** credentials for the respective functions

### `wa-booking-service` (Railway / Node)

See [backend/wa-booking-service/README.md](../backend/wa-booking-service/README.md): WhatsApp tokens, Meta verify token, optional header image URLs for templates, anon key for Supabase callback posts.

