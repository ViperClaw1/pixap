# ADR 0002: Edge Functions as a thin BFF for privileged operations

**Status:** Accepted

## Context

Some operations can't run under user RLS. They need the service role, third-party secrets (Gemini, Groq, Apple, Google, Lemon Squeezy), or several writes in a fixed order, as in booking confirmation. Doing these on the client would put secrets and business rules in the app binary.

## Decision

Privileged and multi-step operations run in Supabase Edge Functions (Deno), called with `supabase.functions.invoke`. The PixAI booking chat, including its Gemini prompt, was moved from the client into `pixai-booking-chat` for the same reason: the prompt and the model fallback chain can change without an app release.

Gateway JWT verification is turned off (`verify_jwt = false`) because the gateway rejects some valid ES256 session tokens (supabase/supabase#44530). Each function authenticates its caller itself. The full mapping is in [api.md](../api.md#edge-function-auth-verify_jwt--false).

## Consequences

- Secrets stay on the server, and prompts can be changed without a store review.
- Each function has to check auth itself, and a function that forgets to is open to anyone. `transcribe-audio` is open today; see Known limitations in the README.
- Cold starts add latency to the first call.
