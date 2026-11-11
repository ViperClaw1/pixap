# ADR 0001: Postgres RLS instead of a custom CRUD API

**Status:** Accepted

## Context

Most app traffic is CRUD on rows owned by one user: cart items, bookings, stories, follows. Writing a REST service for these means writing ownership checks for every endpoint, plus deploying and scaling another service.

## Decision

The mobile client calls PostgREST directly through `supabase-js`, authenticated with the user's JWT. Postgres Row Level Security policies in `supabase/migrations/` do the authorization. Entity hooks in `src/entities/*` wrap these calls in TanStack Query.

## Consequences

- No CRUD backend to maintain. Authorization sits next to the data and also applies to Realtime subscriptions.
- Policies must be reviewed as code. A missing policy shows up as empty results, and an overly broad one leaks data. Both fail quietly.
- Anything that needs privileges, crosses tables, or calls third parties goes through Edge Functions instead (see [ADR 0002](0002-edge-functions-as-bff.md)).
