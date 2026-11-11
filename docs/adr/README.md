# Architecture & engineering records

Back to the [README](../../README.md).

| Folder | What's inside | When to add a file |
| --- | --- | --- |
| `./` (`NNNN-*.md`) | **Decisions (ADRs)**: context, decision, consequences | When choosing something that is expensive to undo |
| [`architecture/`](architecture/) | **Current structure**: layers, boundaries, dependency rules | When the structure changes |
| [`performance/`](performance/) | **Measurements and audits**: baseline, findings, before/after | Each profiling pass on a release build |
| [`pipelines/`](pipelines/) | **Data and media pipelines**: how data flows end to end and which budgets apply | When a pipeline or its budget changes |

## Decisions

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-rls-instead-of-custom-api.md) | Postgres RLS instead of a custom CRUD API | Accepted |
| [0002](0002-edge-functions-as-bff.md) | Edge Functions as a thin BFF for privileged operations | Accepted |
| [0003](0003-idempotent-webhooks.md) | Idempotent webhooks via DB unique constraints | Accepted |
| [0004](0004-whatsapp-venue-confirmation.md) | WhatsApp venue confirmation in a separate stateful Node service | Accepted |
| [0005](0005-feature-sliced-design.md) | Feature-Sliced Design with lint-enforced boundaries | Accepted |

## Architecture

- [Frontend architecture (FSD)](architecture/frontend-fsd.md): layer stack, import rules, ESLint boundaries, entity dependency graph, refactor audit. Implements ADR 0005.
- [System overview](../system-overview.md): repo layout, data model, booking flows.
- [API & auth reference](../api.md): Edge Functions, `wa-booking-service`, auth per function, environment.

## Performance

All runs are on an Android release build, with the POCO C71 (low-end) as the reference device.

| Report | Area | Key result | Status |
| --- | --- | --- | --- |
| [Startup (phase 1)](performance/startup.md) | Cold start, first render, React Query defaults, over-fetching | 12 findings (7 high), refactor order fixed | Static audit; runtime TTF/TTI not measured yet |
| [List rendering](performance/list-rendering.md) | Virtualization, rerender pressure | 30 s feed + stories scroll: **1 frame > 16 ms, 0 > 32 ms** | Baseline recorded; lists are not the bottleneck |
| [Image runtime latency](performance/image-runtime-latency.md) | expo-image cache hits, decode-size bucketing, prefetch, transitions | Bottleneck moved from lists to the media pipeline; `quantizeDecodePx`, prefetch cap of 12 / concurrency 4 | Code changes in; perceptual before/after pending |

How the reports connect: the startup audit led to the list audit, which showed frame pacing is healthy, so the work moved to the image pipeline and image runtime latency.

Related measurements and tooling: [EGRESS_METRICS](../EGRESS_METRICS.md) (egress per monthly active user, before/after), [PHASE_14_PERFORMANCE_TOOLING](../PHASE_14_PERFORMANCE_TOOLING.md), [bundle-baseline.json](../../bundle-baseline.json) (~7.22 MB Hermes).

## Pipelines

| Pipeline | Docs |
| --- | --- |
| **Images**: upload normalization (2048 / 1080 px, JPEG 0.82), resize policy, preload budget, memory hotspots | [image-pipeline.md](pipelines/image-pipeline.md) |
| **Image delivery / storage**: pre-generated WebP, `/render/image/` fallback, public buckets, cached egress | [SUPABASE_IMAGE_TRANSFORMS_SETUP](../SUPABASE_IMAGE_TRANSFORMS_SETUP.md), [STORAGE_P2_PUBLIC_BUCKETS](../STORAGE_P2_PUBLIC_BUCKETS.md), [CACHED_EGRESS_CHECKLIST](../CACHED_EGRESS_CHECKLIST.md) |
| **WhatsApp venue confirmation**: start → `wa-booking-service` → callback → Realtime | [n8n-wa-booking](../n8n-wa-booking.md), [ADR 0004](0004-whatsapp-venue-confirmation.md), [service README](../../backend/wa-booking-service/README.md) |
| **AI booking chat**: client → `pixai-booking-chat` → Gemini (fallback chain) → rerank | [AI_BOOKING_CHAT_ARCHITECTURE](../AI_BOOKING_CHAT_ARCHITECTURE.md), [AI_BOOKING_CHAT_FINAL_REPORT](../AI_BOOKING_CHAT_FINAL_REPORT.md), [deep-dive](../deep-dive/pixai-booking-chat-2026-08-25.md) |
| **Backend orchestration** | [PHASE_13_BACKEND_ORCHESTRATION](../PHASE_13_BACKEND_ORCHESTRATION.md) |
| **Subscriptions & credits** (IAP → entitlements) | [deep-dive](../deep-dive/subscriptions-and-credits-2026-08-25.md), [ADR 0003](0003-idempotent-webhooks.md) |

## Template for a new ADR

```md
# ADR NNNN: <decision>

**Status:** Proposed | Accepted | Superseded by NNNN

## Context
## Decision
## Consequences
```
