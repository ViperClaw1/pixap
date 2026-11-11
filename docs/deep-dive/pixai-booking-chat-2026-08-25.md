# Deep Dive: supabase/functions/pixai-booking-chat

**Scope**: `index.ts` (473 lines), plus its two shared deps `_shared/consumeAiCredits.ts` and `_shared/softenAssistantFallbackTone.ts`.

## Overview

Deno edge function behind the "Pix AI concierge" booking chat. Given a fixed candidate list of `places` plus a free-text `user_message`, it asks Gemini to rerank/filter/exclude from that list and return a short natural-language reply — it never lets the model invent venues, only reorder what the client already has. It's a rerank-and-narrate layer over an existing search result, not a search engine itself.

## Request flow (top to bottom)

1. **Auth** — requires `Authorization` header, verified via a request-scoped Supabase client (`userClient.auth.getUser()`) using the caller's own JWT, not the service key.
2. **Validate body** — `user_message` required, `places` must be non-empty (empty list short-circuits with a canned "run a new search" reply, no Gemini call, no credit charge).
3. **Build prompt** — `buildSystemPrompt(uiLocale)` returns a large rules block (see Concepts below); `userPayload` is the JSON the model actually sees: place fields truncated (`description` to 200 chars, `menu_items` to 10), plus clamped conversation history (last 24 messages).
4. **Call Gemini** — `callGeminiJsonWithModelFallback` tries a chain of model ids until one returns `200`.
5. **Repair the model's JSON** — `validateAndRepairShape` never trusts the model's output shape as-is.
6. **Tone pass** — `softenAssistantFallbackTone` rewrites the model's own reply text if it slipped into "no results found" phrasing.
7. **Charge credits** — token-usage-scaled deduction via `consumeAiCredits`, after the response is already computed (so a credit failure still returns a real answer's shape... except it doesn't — see Concepts/gotcha below).
8. **Respond** with `{ message, filters, rerankedPlaceIds, excludedPlaceIds, explanation?, credits }`.

## Key Components

**`validateAndRepairShape(raw, places)`** — treats the model output as untrusted input, not just "probably fine JSON." Rebuilds `rerankedPlaceIds` from scratch: filters the model's array down to ids that exist in the input, dedupes, then appends any place the model omitted (`tail = visibleOrdered.filter(id not in head)`) — so the model can influence order but can never drop a place by omission, only via explicit `excludedPlaceIds` (which is itself filtered to allowed ids). If the whole `raw` is garbage (not an object), falls back to `base`: identity order, empty exclusions, a generic message. This is what makes rules like "rerankedPlaceIds must include ALL non-excluded ids exactly once" enforceable even though nothing stops the model from violating them.

**Gemini model fallback chain** (`MODEL_FALLBACK_CHAIN`, `buildCandidateModels`, `tryGeminiGenerate`, `callGeminiJsonWithModelFallback`) — tries models in order, advancing only on `404`/`403` (model not found/not enabled for this key), and hard-failing immediately on any other error status (rate limit, 500, etc. abort the whole request rather than burning through the rest of the chain). `GEMINI_MODEL` secret can pin/prepend a specific model ahead of the hardcoded chain — useful for canarying a new Gemini version without a deploy. Note the chain lists `gemini-3-flash-preview` after `gemini-2.5-flash` and mixes in older `1.5`/`2.0` ids — read as "prefer newest, degrade toward whatever's still enabled on this API key," not a recommendation of those specific ids for new code.

**`softenAssistantFallbackTone`** (in `_shared/`) — a regex-based tone filter, separate from the prompt's own "BANNED phrasing" instructions. Belt-and-suspenders: the system prompt already tells Gemini never to say "I didn't find X," but this function post-processes the reply anyway and rewrites banned phrases (English + Russian patterns) into suggestive framing, or replaces the whole message with a canned fallback line if regex-stripping leaves under 12 chars. Triggers whenever `BANNED_SNIPPET` matches, or whenever `isFallback`/`!hasFtsMatch` is true — i.e., it always runs on fallback-search turns regardless of what the model actually said, not just as a safety net for prompt violations.

**Credit charging** (`consumeAiCredits`, called after the AI response is built) — `delta` scales linearly from 0.25 credits (≤500 total tokens) to 0.5 credits (≥1500 tokens) based on actual Gemini usage, not a flat per-call price. `consumeAiCredits` itself calls an RPC (`consume_ai_query_credit`) with a request-scoped signature first, and silently retries with an older 4-arg signature if the DB reports "function not found" / "schema cache" — a live migration shim, meaning two versions of that Postgres function may coexist in the DB right now.

## Concepts

**Server-authoritative reranking, client-supplied candidate set**: the model can only reorder/exclude from `places` the *client* sent — it has no DB access, no search capability of its own. This means result quality is capped by whatever candidate list the caller already assembled (likely from a separate FTS/search endpoint); this function is purely "explain and reorder," and `meta.fts_matched`/`meta.is_fallback` are just hints passed through from that upstream search step.

**Tone-shaping via prompt + regex, not model choice**: rather than accept "no good matches" as a valid model output, both the system prompt (`BANNED phrasing`) and post-processing (`softenAssistantFallbackTone`) actively suppress it. Worth knowing if debugging "the assistant sounds falsely confident" — that's a deliberate product choice enforced at two layers, not a hallucination bug.

**Ordering gotcha**: credits are deducted *after* the Gemini call succeeds and the reply is built, using real token counts from `usageMetadata`. If `consumeAiCredits` then fails with `insufficient_ai_credits`, the function discards the already-computed `repaired` result and returns a bare `402` — the Gemini API cost was already paid but the reply itself is thrown away server-side. This is *not* a silent failure client-side, though: `geminiBookingChatAdapter.ts` detects the 402 (and the equivalent `{error:"insufficient_credits"}` body) and throws a sentinel `INSUFFICIENT_AI_CREDITS_ERROR`; `BookingInlineAssistantChat.tsx` watches for that sentinel specifically and routes to `SubscriptionPaywall` with `reason: "no_credits"` plus a balance refresh, instead of showing it as an inline chat error like every other failure. So the discarded reply is a real (minor) cost — wasted Gemini spend on a turn the user never sees — but the UX path is deliberate and handled, not a gap.
