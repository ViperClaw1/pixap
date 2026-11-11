# ADR 0005: Feature-Sliced Design with lint-enforced boundaries

**Status:** Accepted

## Context

The client covers discovery, booking, cart, stories, an AI concierge, and subscriptions. Without enforced boundaries, features start importing each other and changes leak between unrelated screens.

## Decision

`src/` follows Feature-Sliced Design: `app → pages → widgets → features → entities → shared`. ESLint enforces the import direction and treats each slice as isolated. Server state lives only in TanStack Query hooks. There is no global client store for server data. Details are in [architecture/frontend-fsd.md](architecture/frontend-fsd.md).

## Consequences

- Each feature can be read and removed on its own, and lint catches imports that cross layers.
- There is more boilerplate per feature (api / model / ui / index).
