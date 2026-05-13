# IMAGE_PIPELINE_REPORT

## Scope

- Goal: reduce image-bound jank, decode pressure, and memory spikes in feed/stories/viewers/galleries.
- Constraints respected: no architecture rewrite, no global state migration, incremental fixes only.
- Runtime before/after measurements to be collected on Android release device.

## Current Pipeline Snapshot

- Primary image stack: `expo-image` through `SmartImage`.
- Centralized image wrapper: `src/shared/ui/smart-image/SmartImage.tsx`.
- Current strengths:
  - global `cachePolicy="memory-disk"`,
  - optional `blurhash` support in wrapper,
  - prefetch helper exists,
  - most critical screens already use optimized URLs.
- Current risks:
  - some avatar/story paths still use non-optimized URIs,
  - feed row rerender scope can still trigger excessive image work,
  - preload policies vary by screen and still need strict near-visible budget alignment.

## Detailed Findings

| Issue | File location | Root cause | Severity | Recommended minimal fix | Expected impact |
|---|---|---|---|---|---|
| Feed image rendering still tied to broad parent rerenders | `src/pages/stories-feed/ui/StoriesFeedPage.tsx` | Parent state changes can remount/update image-heavy row subtree | High | Move image block into memoized row subcomponent with stable URI props | Lower scroll hitching and JS spikes |
| Story viewer prefetch can over-prioritize large assets | `src/pages/story-viewer/ui/StoryViewerPage.tsx` | Prefetch path uses large fullscreen targets repeatedly on navigation | Medium-High | Keep prefetch to nearest next assets only; verify dedupe and cap | Lower decode/network bursts |
| Story slide decode cost under fullscreen conditions | `src/components/stories/StorySlide.tsx` | Fullscreen image path is expensive even when optimized; frequent transitions | Medium | Keep optimized+fallback path, tune quality by device class if needed | Reduced memory pressure and transition stutter |
| Gallery fullscreen still expensive under long sessions | `src/pages/place-gallery/ui/PlaceGalleryPage.tsx` | Fullscreen high-res sequence with autoplay-like progression | Medium-High | Add low-res placeholder strategy and stricter next-item prefetch cap | Lower flicker and memory spikes |
| Prefetch policy needed strict global cap enforcement | `src/shared/ui/smart-image/SmartImage.tsx` | Screen-level callers can enqueue many URLs without unified near-visible contract | High | Enforce near-visible only policy (3-5 items) + hard cap + batched prefetch | Stabilized memory and network load |
| Blurhash/placeholder underused in hot visual paths | `src/pages/stories-feed/ui/StoriesFeedPage.tsx`, `src/pages/feed-story-viewer/ui/FeedStoryViewerPage.tsx`, `src/pages/place-gallery/ui/PlaceGalleryPage.tsx` | Placeholder support exists but not consistently wired with data | Medium | Add lightweight preview placeholder where metadata exists | Reduced visible flicker |
| Avatar resize consistency is incomplete | `src/pages/stories-feed/ui/StoriesFeedPage.tsx`, related avatar surfaces | Multiple avatar usages rely on raw/public URL without explicit size policy | Medium | Standardize avatar resize widths per surface type | Lower bandwidth and decode overhead |

## Resize Policy Matrix (Target)

| Surface | Current state | Target policy | Notes |
|---|---|---|---|
| Feed cards | Optimized URL exists | viewport x DPR quantized, quality 72-78 | Keep fallback to original |
| Stories viewer fullscreen | Optimized + fallback mostly present | 1080x1920 baseline, device-aware quality | Maintain UX parity |
| Feed story viewer | Optimized path present | Keep, verify no duplicate prefetch | Already near target |
| Gallery fullscreen | Optimized primary + fallback present | Add low-res placeholder and stricter prefetch | Biggest remaining visual polish gap |
| Archive grid | Optimized thumbs present | Keep with quantized sizing | Good current implementation |
| Avatars | Mixed optimized/raw usage | enforce per-size buckets (small/medium/large) | Apply only in hot-path screens first |

## Preload Budget Policy (Target, Mandatory)

- Only preload near-visible items:
  - feed: first visible rows and immediate next rows only,
  - viewer: current +-2,
  - gallery: current + next 1-2.
- Global hard cap per preload call: fixed max URLs (already enforced in wrapper).
- Batched prefetch with controlled concurrency (already enforced in wrapper).
- Avoid preloading entire datasets or long-tail image sets.

## Memory-Pressure Hotspots

1. Feed image-heavy rows under broad rerender scope.
2. Fullscreen viewer/galleries during rapid navigation.
3. Large avatar/image sets rendered simultaneously in headers/rows.

## Minimal Safe Fix Queue (Next Change Iteration)

1. Feed row image memo boundary extraction.
2. Unified avatar resize policy on feed/story surfaces.
3. Add placeholder/preview strategy for gallery and story fullscreen.
4. Validate prefetch call sites against near-visible-only contract.

## Android Release Measurement Checklist (Before/After)

- Use same device and same app build channel (release).
- Run each scenario 3 times; capture median.

### Scenarios

1. Feed open + continuous scroll 60s.
2. Story viewer open + 30 story transitions.
3. Place gallery open + 20 swipes.
4. Feed + background/foreground cycle + reopen.

### Metrics

- Feed FPS avg / p95
- Scroll hitch count
- Memory peak (MB) and post-GC memory
- Image flicker count (visual events)
- JS thread spike count
- Media network bytes downloaded

## Baseline/Result Template

| Scenario | Metric | Before | After | Delta | Notes |
|---|---|---:|---:|---:|---|
| Feed 60s scroll | FPS avg |  |  |  |  |
| Feed 60s scroll | Hitch count |  |  |  |  |
| Feed 60s scroll | Memory peak (MB) |  |  |  |  |
| Story viewer transitions | FPS avg |  |  |  |  |
| Story viewer transitions | Flicker count |  |  |  |  |
| Place gallery swipes | Memory peak (MB) |  |  |  |  |
| All scenarios | Media bytes (MB) |  |  |  |  |

## Regression Validation Gate

- No visual regressions (cropping, wrong aspect, flicker increase).
- No functional regressions (tap/swipe/navigation behavior unchanged).
- Performance acceptance:
  - no FPS regression,
  - no memory increase >10% on scenario peaks,
  - reduced or equal flicker count vs baseline.
