# ADR 0004: WhatsApp-mediated venue confirmation via a separate Node service

**Status:** Accepted

## Context

Most target venues (CIS, Dubai) have no booking API, but they do answer WhatsApp. Confirming a booking means messaging the venue, waiting minutes to hours for a reply, parsing it (availability, price), and pushing the result to the user's cart.

## Decision

A standalone Express service, `backend/wa-booking-service` (deployed on Railway), owns the conversation state machine: availability, then pricing, then a payment link or a free booking. It talks to the Meta WhatsApp Cloud API. It reports progress to Supabase by posting to `n8n-wa-booking-callback` with a callback token for each cart and a shared secret, and that function updates `cart_items`. The app shows progress through a Realtime subscription on `cart_items`, with polling as a fallback.

Edge Functions were rejected for this because they're short-lived and stateless, while a venue conversation is long-running and needs state.

## Consequences

- Works with any venue that has a phone number. The venue doesn't have to integrate anything.
- Booking state is held in memory, so it is lost on restart and the service can't scale out. Persisting it to Postgres is on the roadmap.
- For US venues, where WhatsApp isn't widely used, voice (Retell) and email channels go through the same service.
