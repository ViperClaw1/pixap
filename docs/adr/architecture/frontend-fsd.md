# Pixap — frontend architecture (FSD)

The mobile app under `src/` follows **[Feature-Sliced Design (FSD)](https://feature-sliced.design/)**: layers run from the **application shell** (`app`) down to **shared** primitives. **Exact import rules** are enforced by ESLint (see [Import rules](#import-rules-summary)) — not only strict "downward only" intuition (e.g. `entities` and `shared` may import `app` where the config allows it).

## Layer stack (top → bottom)

| Layer | Path | Role |
|-------|------|------|
| **App** | `src/app/` | Application shell: **React Navigation** (`navigation/`), **providers** (`AuthProvider`, `ThemeProvider`, `AppProviders`), deep-link subscription helpers that need navigation types. |
| **Pages** | `src/pages/` | Route-level screens: one folder per route slice (`ui/`, `model/`, `lib/` as needed). **No imports from another page slice** (use `widgets/`, `shared/`, or lift shared UI). |
| **Widgets** | `src/widgets/` | Composite UI blocks reused on several screens (e.g. story discussion panel, stories archive, place card, cart rows, feed list). May use **entities**, **features**, **shared**. |
| **Features** | `src/features/` | User scenarios isolated per folder (`api/`, `model/`, `ui/`, …). **No imports between different feature slices** (enforced per slice in ESLint). |
| **Entities** | `src/entities/` | Business domain: data hooks, models, segment APIs. **Cross-entity imports are allowed** when there is no circular dependency (see graph below). |
| **Shared** | `src/shared/` | UI kit (`shared/ui/`), theme, `shared/lib/`, `shared/api/`, `shared/model/types/`, etc. **No imports from** `app`, `pages`, `widgets`, `features`, or `entities`. |

`App.tsx` at the repo root wires providers, navigation container, and global side effects.

## Import rules (summary)

Enforced by **`eslint-plugin-boundaries`** in `eslint.config.mjs` (see `boundaries/dependencies` rules):

| From | May import |
|------|------------|
| **app** | `app`, `pages`, `widgets`, every **feature** slice, `entities`, `shared` |
| **pages** | `pages`, `widgets`, every feature slice, `entities`, `shared`, `app` |
| **widgets** | `widgets`, every feature slice, `entities`, `shared`, `app` |
| **feature slice** (`src/features/<name>/`) | only that **same** slice, `entities`, `shared`, `app` |
| **entities** | `entities`, `shared`, `app` |
| **shared** | `shared`, `app` |

Cross-imports between **different page slices** are avoided by convention (compose via `widgets` / `shared`). **Entity → entity** imports are allowed when the graph stays **acyclic** (see below).

Path aliases (see `tsconfig.json`): `@/*` → `src/*`, plus `@/app/*`, `@/pages/*`, `@/widgets/*`, `@/features/*`, `@/entities/*`, `@/shared/*`.

## ESLint boundaries

`eslint.config.mjs` uses **`eslint-plugin-boundaries`** (`boundaries/dependencies`):

- Each **feature slice** is a separate element type (`feature-ai-booking-chat`, …). Folder **`src/features/<name>/`** must have **`<name>`** in the **`FEATURE_SLICES`** array in `eslint.config.mjs` (current slices: `ai-booking-chat`, `auth-session-redirect`, `email-verification-otp`, `message-attachments`, `message-link-preview`, `subscription-paywall-redirect`).
- Legacy `src/components/` has been removed; UI lives under **`shared/ui/`** and **`widgets/`**.

## Entity dependency graph (cross-entity)

Directed edges (no cycles, verified with `madge --circular src/entities`):

- `notification` → `booking` (types)
- `booking` → `cart`, `pixai`
- `pixai` → `business-card`
- `post` → `user`, `story` → `user`

## Refactor audit (phases 1–7) — what moved

| Before | After |
|--------|--------|
| `src/navigation/` | `src/app/navigation/` |
| `src/contexts/` | `src/app/providers/` (`AuthProvider.tsx`, `ThemeProvider.tsx`) |
| `src/lib/`, `src/services/`, `src/types/` | `src/shared/lib/`, `src/shared/model/types/`, etc. |
| `src/components/` | `src/shared/ui/*`, `src/widgets/*` |
| Page-to-page imports | Resolved via `shared/theme`, `widgets/*` |
| Monolithic `features` boundary | Per-slice feature types in ESLint |

## Commands

```bash
npm run lint
npx madge --circular --extensions ts,tsx src/entities
```

For a full dependency graph (optional): `npx madge --image graph.svg src` (requires Graphviz).

## Documentation (phase 7)

- **README** — repository paths, mobile layers, navigation/linking paths, and **Further reading** link to this file.
- **This document** — canonical FSD map, ESLint matrix, entity edges, migration table, tooling commands.

## Related

- Product and backend overview: [README.md](README.md)
