# System overview

Detailed reference for the mobile client, data model, and booking flows. Back to [README](../README.md). Frontend layering: [frontend-fsd.md](adr/architecture/frontend-fsd.md). Edge Function and service APIs: [api.md](api.md).

## Repository layout

| Path | Role |
|------|------|
| `App.tsx` | Root: gesture handler, safe area, theme, React Query, auth, splash, permissions gate, navigation. |
| `app.config.ts` | Expo config: app id, scheme `pixap`, iOS/Android, `extra` env passthrough, Google Maps keys, associated domains. |
| `src/pages/` | Route-level UI (FSD **pages**): home, place detail, booking, cart, stories, profile, auth, paywall, etc. |
| `src/app/navigation/` | Tab + stack navigators, deep linking config, route types. |
| `src/app/providers/` | `AuthProvider`, `ThemeProvider`, `AppProviders`. |
| `src/widgets/` | Composite blocks reused across screens (feed list, place card, story discussion, …). |
| `src/features/` | Isolated user scenarios (one ESLint slice per subfolder). |
| `src/entities/` | Domain hooks and models (cart, bookings, stories, PixAI, …) — TanStack Query + Supabase. |
| `src/shared/` | `shared/ui/`, `shared/lib/` (env, linking helpers, push/IAP), `shared/api/` (typed Supabase client), `shared/model/types/`. |
| `supabase/migrations/` | SQL schema and RLS evolution. |
| `supabase/functions/` | Deno Edge Functions (see [API reference](api.md)). |
| `supabase/proxy/api.pixapp.kz.nginx.conf.example` | Example nginx routes for Lemon (and pattern for other paths). |
| `backend/wa-booking-service/` | Standalone Express WhatsApp booking service ([local README](../backend/wa-booking-service/README.md)). |

---

## Mobile app layers

The client follows **Feature-Sliced Design** under `src/` (layers, ESLint slices, entity graph, refactor audit): **[frontend-fsd.md](adr/architecture/frontend-fsd.md)**.

### Presentation

- **Screens** (`src/pages/`) compose UI and call hooks; there is no separate MVVM layer — **hooks + React Query** own async state.
- **Widgets** (`src/widgets/`) and **shared UI** (`src/shared/ui/`): composite screen sections (story strip, place card, feed list) and reusable UI (directions modal, booking place panel, story progress bar, shimmers).

### Navigation

- **`src/app/navigation/AppNavigator.tsx`**: Bottom tabs **Home**, **Feed**, **Bookings**, **Cart**, **Profile**. Each tab is a **native stack** with shared screen names (place detail, booking flow, story viewer/composer, paywall, etc.).
- **`src/app/navigation/linking.ts`** + **`src/shared/lib/linking.ts`**: Universal / custom scheme links, nested screen paths; special handling for `payment-success` and `payment-canceled` to open the cart stack with the right screen.

### Application state

- **`AuthProvider`** (`src/app/providers/`): Wraps `supabase.auth` session lifecycle, sign-up/in/out, password reset redirects, and registers push tokens when `user.id` is present (context is internal; consumers use the exported hook).
- **`ThemeProvider`**: Light/dark palette and navigation theme bridge.

### Data access

- **Direct PostgREST** via `supabase.from(...)` in **entity** (and occasionally feature) hooks for tables the user is allowed to read/write under RLS (e.g. `business_cards`, `cart_items`, `bookings`, stories).
- **Edge Functions** via `supabase.functions.invoke("<name>", { body, headers })` for privileged or multi-step operations (PixAI orchestration, slot computation, WhatsApp start, confirm booking, IAP).

### Cross-cutting

- **`expo-constants`** + `app.config.ts` **`extra`** expose `EXPO_PUBLIC_*` at runtime (`src/shared/lib/env.ts`).
- **Google Maps**: Native maps + REST Directions/Geocoding; listings store **address text** (not lat/lng) — the app geocodes for pins and routes.

---

## Supabase data and auth

### Auth

- Email/password and OAuth (Google / Apple) go through **Supabase Auth**; the client uses **AsyncStorage** for session persistence.
- Mobile OAuth return URLs use the app **scheme** (see `getOAuthRedirectUri` / OAuth callback screen); hosted **HTTPS** base is used for email confirmation and password reset links (`EXPO_PUBLIC_OAUTH_REDIRECT_BASE`).

### Notable tables (from migrations; names are indicative)

- **`business_cards`**: Venues/services: name, address, city, rating, booking fields, images, `contact_whatsapp`, tags, category, etc.
- **`cart_items`**: Service booking drafts in the users cart; status `created` | `paid` | `expired`; columns for **WhatsApp flow** (`wa_n8n_*`, `wa_status_lines`, `wa_confirmable`, `wa_confirmed_price`, `wa_payment_link`, &).
- **`bookings`**: Confirmed reservations; `payment_status` reflects paid vs pending (venue links, Lemon, free flows, etc.).
- **`shopping_*`**: Shopping cart line items and catalog items (Lemon / external checkout where used).
- **`stories`**, **`story_comments`**, **`story_reactions`**, **`user_follows`**: Social stories feed.
- **`subscription_entitlements`**, **`subscription_transactions`**, **`subscription_receipts`**, **`subscription_events`**: IAP subscription state and audit trail.
- **`processed_lemon_orders`**: Idempotency for Lemon webhooks.

Exact columns and RLS live in `supabase/migrations/`; regenerate client types when schema changes.

### Realtime

- Example: `useCartItems` subscribes to **`postgres_changes`** on `cart_items` for the signed-in user so WhatsApp callback updates refresh the UI without manual polling (polling is still used as a fallback while a WA flow is in progress).


## Business domains and flows

### 1. Discovery and place detail

- Users browse **home / category / search** data from `business_cards` (and related hooks).
- **Place detail** supports directions via **Geocoding + Directions API** from the users location.

### 2. Manual booking flow

- User picks slot/cost and customer details � **`cart_items`** row (`status: "created"`) via `useCreateCartItem` or related flows.
- Optional **WhatsApp venue confirmation**: client invokes **`n8n-wa-booking-start`** with `cart_item_id`. That Edge Function loads the row (with venue `contact_whatsapp`), ensures a **`wa_n8n_callback_token`**, and **POSTs** a payload to **`wa-booking-service` `POST /webhook/booking`**, which starts the **availability � pricing � payment link / free** state machine and notifies **`n8n-wa-booking-callback`** to patch the same `cart_items` row.
- When `wa_confirmable` is true, the user calls **`confirm-service-cart-booking`** with `action: "confirm"` (free) or `"pay"` (priced path inserts `bookings` with `payment_status: "pending"` until settled elsewhere).

### 3. PixAI-assisted booking

- **`pixai-orchestrate`** (authenticated): given a **flow** (city, mode `nearby` | `city`, category, restaurant-table flag, optional GPS), searches places via RPCs **`search_business_cards_nearby`** / **`search_business_cards_in_city`** with PostgREST fallback; returns **assistant text**, **places**, and **demo slot suggestions** (the edge function currently returns illustrative slot rows; the app can also use **`get-available-slots`** for real busy/free logic from `bookings`).
- Client-side **`usePixAI`** refreshes the session before invoke to avoid **401 Invalid JWT** on the Functions gateway.

### 4. Shopping cart

- Users manage **shopping** lines in-app; fulfillment and payment are coordinated via **WhatsApp** (availability CTA from cart) and/or **Lemon** checkout on the server side where configured — there is no in-app card processor for goods.

### 5. Lemon Squeezy

- **`lemon-create-checkout`**: Authenticated checkout session creation against Lemons API (store/variant env).
- **`lemon-webhook`**: **No JWT**; validates **`X-Signature`** with `LEMONSQUEEZY_SIGNING_SECRET`, handles `order_created` for `checkout_type` **`shopping_cart`** or **`service_booking`**, marks carts paid and creates bookings as appropriate.

### 6. Subscriptions (IAP)

- **`iap-verify-purchase`**: Client sends purchase payload; function talks to **Apple** / **Google** APIs using configured secrets and upserts **`subscription_entitlements`** (and related rows).
- **`iap-sync-status`**: Lightweight entitlement read + expiry cleanup for the current user.
- **`iap-apple-notifications`** / **`iap-google-rtdn`**: Server-to-server subscription lifecycle events (JWT verify off; secured by Apple/Google payload verification patterns inside).

---

## Layer interactions

### Typical authenticated read/write

1. User signs in � **GoTrue** returns JWT � `supabase-js` attaches it to PostgREST and (when not overridden) to **`functions.invoke`**.
2. Hook runs `queryFn` � `supabase.from("...").select(...)` � **RLS** allows or denies rows.
3. Optional **Realtime** channel invalidates React Query caches on `UPDATE`.

### WhatsApp booking chain

1. Mobile: `supabase.functions.invoke("n8n-wa-booking-start", { body: { cart_item_id } })`.
2. Edge: validates user, loads `cart_items` + `business_cards.contact_whatsapp`, writes callback token if needed, **POST** JSON to **`WA_BOOKING_SERVICE_URL`** (must be public HTTPS in production).
3. **wa-booking-service**: `createBooking` stores state in memory, sends **WhatsApp templates** to the venue, calls **`n8n-wa-booking-callback`** with `callback_token`, `status_lines`, `confirmable`, optional `confirmed_price` / `payment_link`.
4. **n8n-wa-booking-callback**: Validates `N8N_INBOUND_SECRET` (returns 503 if unset), updates **`cart_items`**; mobile Realtime/polling shows progress.
5. Mobile: `confirm-service-cart-booking` creates **`bookings`** and marks cart **paid** when rules match.


---

## Local development

```bash
cp .env.example .env
# Fill EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from Supabase Dashboard → API
npm install
npx expo start
```

**Maps**: after adding Google keys, rebuild a **dev client** or production binary. `expo start` alone does not inject native map SDK keys.

**Supabase**: link the project and run migrations (`supabase db push`). Deploy Edge Functions separately (`supabase functions deploy <name>`).

**WhatsApp service** (optional):

```bash
cd backend/wa-booking-service
npm install
npm run start
```

It listens on **8787** by default (to avoid Metro on 8081). Point **`WA_BOOKING_SERVICE_URL`** in Supabase at an **HTTPS** tunnel or a deployed URL.

**Expo SDK note:** the app targets **SDK 54** to match the Expo Go version in the stores.