# Business Logic Reference: Subscriptions & Internal Credits

Gathered from `supabase/migrations/*`, `supabase/functions/{pixai-booking-chat,pixai-orchestrate,iap-*}`, and `src/entities/{subscription,booking-credits}`, `src/features/booking-access`, `src/pages/subscription-paywall`. Scope: mobile IAP subscriptions + the "booking credit" wallet that pays for AI/route features. **Out of scope**: `lemon-webhook`/`lemon-create-checkout` (Lemon Squeezy) exist in `supabase/functions/` but never touch `subscription_entitlements` or `booking_credit_*` tables — a separate, unrelated payment path (not investigated here).

## 1. Two systems, not one

| | **Subscription Entitlement** | **Booking Credit Wallet** |
|---|---|---|
| What it is | Binary/tiered access record per store product (`subscription_entitlements` table) | A numeric(10,2) balance (`booking_credit_wallets` table) that gets spent per AI/route action |
| Source of truth | Apple/Google receipt verification | Server-side ledger (`booking_credit_ledger`), append-only audit trail |
| Grants access to | `hasPaidPremium` / `hasPremiumPlus` tier flags | Ability to actually *use* AI concierge chat, AI search, and route-building |
| Refills | N/A (active/expired based on store status) | Additive top-up triggered by a **verified** entitlement event |

They're linked one-directionally: a verified subscription purchase/renewal triggers a credit refill, but credits are consumed independently of entitlement status (once granted, credits don't get clawed back if the subscription later expires — see §3).

## 2. Subscription entitlement lifecycle

**Products** (`src/entities/subscription/model/productIds.ts`): 3 tiers × 2 stores.

| Tier | Android SKU | iOS SKU | Credits granted |
|---|---|---|---|
| Weekly | `pixai_premium_weekly` | `pix_weekly` | 100 |
| Monthly | `pixai_premium_monthly` | `pix_monthly` | 250 |
| Annual ("Premium Plus") | `pixai_premium_annual` | `pix_annual` | 1500 |

Annual is the only tier where `isPremiumPlusProduct()` is true — it alone unlocks `hasPostBoostFeature` in `useBookingAccess`.

**Flow**:
1. Client purchases via `useSubscription()` (`src/entities/subscription/api/useSubscription.ts`) → store purchase listener fires → `verifyAndRefresh()` → calls edge function `iap-verify-purchase`.
2. `iap-verify-purchase/index.ts`: verifies the receipt server-side (`verifyStorePurchase`), then:
   - `assertPermanentPurchaseOwnership` — binds the store transaction (`original_transaction_id`/`purchase_token`) to this user permanently in `subscription_purchase_ownerships`; a *different* user later presenting the same receipt gets `409 PurchaseOwnershipError`. Prevents receipt-sharing across accounts.
   - Upserts `subscription_entitlements` (unique on `user_id, product_id, platform`).
   - Upserts `subscription_receipts` keyed on `(platform, sha256(raw_payload))` — dedupes identical webhook/verify payloads.
   - `claimProcessedTransaction()` — inserts into `processed_transactions` (unique on `platform:transactionId`); returns `firstProcessing = true` only once per real transaction.
   - **Only on `firstProcessing`**: inserts a `subscription_transactions` audit row AND calls `refillBookingCreditsForUser` if the verified status is active/trialing/grace_period/billing_retry. This is what makes credit refills idempotent — a retried verify call, a replayed webhook, or a reconciliation poll re-touching the same transaction never double-grants credits.
3. **Ongoing lifecycle events** (not just the initial purchase) also trigger refills, each independently idempotent via the same `claimProcessedTransaction` pattern:
   - `iap-apple-notifications` — Apple Server Notifications (ASN) v2. `shouldRefillCreditsOnAppleNotification()` matches `DID_RENEW`, `SUBSCRIBED`, `DID_CHANGE_RENEWAL_STATUS`, `OFFER_REDEEMED`, `RENEWAL_EXTENDED`.
   - `iap-google-rtdn` — Google Real-Time Developer Notifications. `shouldRefillCreditsOnGoogleNotification()` matches numeric types `{1,2,4,7,8}` (Play's renewal/recovery/purchase codes); type `12` is hardcoded to force `status = 'revoked'`.
   - `iap-reconcile-subscriptions` — cron-triggered (bearer-gated by `IAP_RECONCILIATION_SECRET` or the service key), periodically re-verifies stored entitlements against the store directly and writes a diff to `subscription_reconciliation_audit` (catches missed webhooks).
   - `iap-sync-status` — client-triggered lightweight sync: expires any local entitlement row past `expires_at` and returns current status. Called on session start/resume (`useSubscription`'s effect watching `session.access_token`).

**Client read side**: `useEntitlement()` reads `subscription_entitlements` directly via RLS (`select own`), not through an edge function — cached to `AsyncStorage` (`entitlementCache.ts`) with a 72h offline-grace window so a network blip doesn't yank premium status mid-session. A 7-day-from-signup "intro trial" window is computed client-side (`INTRO_FREE_DAYS`) but note: **this `isIntroTrialActive` flag in `useEntitlement` is unused by `useBookingAccess`** — the actual intro-period logic lives server-side in the credit wallet (§3), a separate 1-day window. Two different "intro" concepts with different durations coexist; only the wallet one gates real features.

## 3. Booking credit wallet (`booking_credit_wallets` / `booking_credit_ledger`)

One row per user, `balance numeric(10,2)`, created lazily (`ensure_booking_credit_wallet`, also fired via an `on_auth_user_created` trigger on signup).

**Grants** (all via `refill_booking_credits`, SQL in [`20260727000000_ai_credits_refactor.sql`](../supabase/migrations/20260727000000_ai_credits_refactor.sql)):
- **Intro grant**: 10 credits, valid for **1 day** from account creation (`v_created_at + interval '1 day'`) — was 3 credits / 7 days pre-refactor.
- **Subscription refill**: additive, not "set to" — a renewal stacks on top of whatever's left (`v_new_balance := v_old_balance + v_grant`). Runs only if the user currently has a matching *active* `subscription_entitlements` row for that exact `product_id` (checked inside `refill_booking_credits` itself, redundant with the idempotency check upstream — belt-and-suspenders).
- Credits granted by a subscription **never expire** once granted, even if the subscription later lapses. Only the *intro* grant expires (`expire_intro_credits_if_needed`, zeroes the balance once the 1-day window passes **and** the user has no active premium entitlement — called defensively before every consume/read operation, not on a timer).

**Consumption paths** — three call sites, three different pricing models:

| Consumer | Where | Pricing | Blocks on insufficient credits? |
|---|---|---|---|
| AI concierge chat turn | `pixai-booking-chat` edge fn → `consume_ai_query_credit` RPC | 0.25 credits ≤500 total tokens, scaling linearly to 0.5 at ≥1500 tokens (real Gemini `usageMetadata`) | Yes — 402, reply discarded (see [pixai-booking-chat deep dive](pixai-booking-chat-2026-08-25.md)) |
| AI orchestrated search | `pixai-orchestrate` edge fn → same `consume_ai_query_credit` RPC | **Flat 0.25**, not token-scaled — inconsistent with the chat path above despite sharing the same RPC and the same `consumeAiCredits` shared wrapper | Yes — 402 |
| Route building (Directions API) | Client-side `useVibePlanRoute` → `consume_route_build_credit` RPC directly (no edge function) | `0.10 + 0.05×(stops−1)`, capped at `0.25` (1 stop=0.10, 2=0.15, 3=0.20, 4+=0.25) | **No** — route is fetched and shown regardless; `insufficientCredits` flag is surfaced to UI but the already-paid-for (Google-side) route data is never discarded |

Both RPC families short-circuit to unlimited use for admins (`profiles.account_role = 'admin'`) — returns `{ok:true, balance:-1}` without touching the wallet, a sentinel meaning "not tracked," not a literal negative balance.

**Idempotency on the AI-consume path specifically**: `consume_ai_query_credit` takes a `p_request_id` (client-generated UUID, threaded through from `body.request_id` in the edge function). A unique partial index `booking_credit_ledger_ai_request_idx` on `(user_id, request_id) where request_id is not null` means a retried request with the same id returns the previously-charged amount (`deduplicated: true`) instead of charging twice — added in [`20260806123000_pixai_chat_credit_idempotency.sql`](../supabase/migrations/20260806123000_pixai_chat_credit_idempotency.sql) after the fact (originally `request_id` wasn't required at all).

**Dead code / legacy trace**: `booking_credit_reason` enum still has `booking_consume`, and the [`admin_booking_credits_exempt.sql`](../supabase/migrations/20260528120000_admin_booking_credits_exempt.sql) migration still defines `consume_booking_credit_on_booking_insert()` with admin-exempt logic — but the *trigger* that called it (`consume_booking_credit_before_insert` on `public.bookings`) was dropped in the `ai_credits_refactor` migration ("booking inserts no longer consume credits"). The function itself is orphaned: defined, never attached to a trigger. Booking a table has been unconditionally free since that refactor; only AI chat, AI search, and route-building spend credits now.

## 4. Client-side feature gating (`useBookingAccess`)

`src/features/booking-access/model/useBookingAccess.ts` is the single place that turns entitlement + wallet state into feature flags:

```
hasPaidPremium  = credits.hasPaidPremium (server-computed) OR (entitlement.isActive AND isPaidPremiumProduct(entitlement.product_id))
hasPremiumPlus  = credits.hasPremiumPlus OR (entitlement.isActive AND isPremiumPlusProduct(...))       // annual only
hasCreditsBalance = balance > 0 OR (creditsQuery errored AND hasPaidPremium)   // fail open for paying users if the credits RPC itself is down
canAccessAIBooking = admin OR (hasCreditsBalance AND (introActive OR hasPaidPremium))
canAccessVibeMatch = same as above
hasPostBoostFeature = admin OR hasPremiumPlus
canAccessBookingFlow = always true   // bookings are never credit-gated
needsPaywall = !loading AND !admin AND !canAccessVibeMatch AND !canAccessAIBooking
```

`credits.hasPaidPremium`/`hasPremiumPlus`/`activeProductId` come pre-computed from the `get_booking_credits_status()` RPC (which derives them from `subscription_entitlements` server-side via `user_active_premium_product_id`), so the client re-derives the same thing a second way from `useEntitlement()` as a fallback/cross-check rather than the sole source.

## 5. Paywall UX (`SubscriptionPaywallPage`)

- Three plan cards (weekly/monthly/annual), monthly pre-selected and visually "highlighted."
- `route.params.reason` drives subtitle copy: `"no_credits"` vs generic `"upgrade"` — this is how `pixai-booking-chat`'s 402 (via `BookingInlineAssistantChat`'s effect on `INSUFFICIENT_AI_CREDITS_ERROR`) and other entry points differentiate the pitch.
- Purchase/restore errors map through a fixed `SubscriptionErrorCode` union (`auth_required`, `invalid_purchase`, `purchase_already_linked`, `no_eligible_offer`, `store_purchase_failed`, `restore_no_purchases`, etc.) to i18n keys — these codes originate from `iap-verify-purchase`'s HTTP status (`classifyVerifyHttpStatus`: 401→auth_required, 400→invalid_purchase, 409→purchase_already_linked) or from the store SDK layer (`user-cancelled`, `no_eligible_offer` parsed from a message-string match).
- `verifyAndRefresh` invalidates both `queryKeys.subscription.entitlement` and `queryKeys.bookingCredits.prefix` after any successful verify — so a purchase immediately reflects in both the entitlement query and the credit balance without a manual refetch call at each call site.

## 6. Quick file map

| Concern | Files |
|---|---|
| Entitlement schema + RLS | `supabase/migrations/20260425_subscriptions_core.sql` |
| Credit wallet schema + core RPCs | `supabase/migrations/20260521120000_booking_credits.sql`, `20260727000000_ai_credits_refactor.sql`, `20260806123000_pixai_chat_credit_idempotency.sql` |
| Weekly tier + credit amount bump | `supabase/migrations/20260724040000_pixai_weekly_tier_and_monthly_credits.sql` |
| Purchase ownership / dedupe tables | `supabase/migrations/20260603123000_iap_production_hardening.sql` |
| Verify a fresh purchase | `supabase/functions/iap-verify-purchase/index.ts` |
| Store-side webhooks | `supabase/functions/iap-apple-notifications/`, `iap-google-rtdn/` |
| Reconciliation cron | `supabase/functions/iap-reconcile-subscriptions/` |
| Client-triggered resync | `supabase/functions/iap-sync-status/` |
| Idempotency helpers | `supabase/functions/_shared/iapIdempotency.ts`, `_shared/bookingCredits.ts`, `_shared/consumeAiCredits.ts` |
| AI credit consumers | `supabase/functions/pixai-booking-chat/`, `pixai-orchestrate/` |
| Route credit consumer | `src/pages/vibe-match/lib/useVibePlanRoute.ts` (direct client RPC) |
| Client entitlement/credits hooks | `src/entities/subscription/api/{useSubscription,useEntitlement}.ts`, `src/entities/booking-credits/api/{useBookingCredits,useBookingCreditsSync}.ts` |
| Feature gating | `src/features/booking-access/model/useBookingAccess.ts` |
| Paywall UI | `src/pages/subscription-paywall/ui/SubscriptionPaywallPage.tsx` |

## 7. Things worth double-checking if you touch this area

- **Flat vs token-scaled AI pricing** (`pixai-orchestrate` 0.25 flat vs `pixai-booking-chat` 0.25–0.5 scaled) — likely an oversight rather than a deliberate pricing decision, since both route through the identical `consumeAiCredits` wrapper; worth confirming with whoever owns pricing before "fixing."
- **Two intro-trial concepts**: `useEntitlement`'s 7-day `isIntroTrialActive` is dead weight — nothing reads it for gating. The wallet's 1-day intro grant (`ensure_booking_credit_wallet`) is what actually matters.
- **Orphaned booking-credit-consume trigger function**: safe to fully drop `consume_booking_credit_on_booking_insert` and the `booking_consume` enum value in a future migration if confirmed unused — currently just dead SQL, not wired to anything.
- **Route-build "fail open"** is intentional per the inline comment (never undo an already-fetched, already-Google-billed route over a credit shortfall) — different philosophy from the AI paths, which fail closed. Know this before "fixing" it to match.
