# ADR 0003: Idempotent webhooks via database unique constraints

**Status:** Accepted

## Context

Lemon Squeezy, App Store Server Notifications, Google Play RTDN, and Meta WhatsApp all deliver at least once. They retry on timeouts and on non-2xx responses. Processing a payment twice means a duplicate booking or duplicate credits.

## Decision

Every webhook claims the event in the database first, using a unique key, and only then applies side effects:

| Source | Dedup key |
| --- | --- |
| Lemon Squeezy | `processed_lemon_orders.lemon_order_id`. A unique violation (`23505`) returns `200 { duplicate: true }` |
| Apple / Google | `subscription_events` upsert on `(platform, event_id)` |
| IAP verify (client) | upsert on `(platform, raw_payload_hash)` |
| Meta WhatsApp | inbound `message.id` (in-memory, see Consequences) |

Payloads are authenticated before they are claimed: Lemon uses an HMAC, Apple a JWS chain, Google a Pub/Sub OIDC token, and Meta `X-Hub-Signature-256`. The Meta webhook sends its 200 before processing, so Meta doesn't retry while slow processing is still running.

## Consequences

- Retries are safe and the handlers stay simple.
- Meta dedup lives in process memory. It resets on restart and isn't shared between replicas. Moving it to a table is on the roadmap.
