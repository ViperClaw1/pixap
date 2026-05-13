# LIST_PERFORMANCE_REPORT

## Scope

- Goal: audit list virtualization and rerender pressure for scroll performance and memory stability.
- Constraints respected: no architecture rewrite, no speculative optimization, incremental only.
- Runtime measurements: to be captured by user on Android release build using checklist below.

## Inventory Summary

- `SectionList`: not found in `src`.
- Primary list primitives:
  - `FlashList`: `stories-feed`, `stories-archive`, `search`.
  - `FlatList`: `messages`, `message-thread`, `bookings`, `home`, `favorites`, `category`, `cart`, `shopping-items`, story components.
  - horizontal `ScrollView`: `stories-feed` header and several UI sheets.
  - `Carousel` (`react-native-reanimated-carousel`): feed media, viewers, galleries.

## Hot-Path Priority

1. Feed (`stories-feed`)
2. Stories archive grid (`stories-archive`)
3. Search results (`search`)
4. Messages thread / inbox (high activity but needs nested-scroll cleanup first for inbox screen)
5. Bookings / recommendations / other medium-load lists

## Detailed Findings

| Issue | File location | Root cause | Severity | Recommended minimal fix | FlashList candidacy | Expected impact |
|---|---|---|---|---|---|---|
| Feed rows rerender on wide state changes | `src/pages/stories-feed/ui/StoriesFeedPage.tsx` | Heavy row render path still inline; multiple action handlers/derived data recreated in parent | High | Extract memoized feed row component + stable callbacks via `useCallback` | Already migrated; keep and harden | Lower JS commits, smoother like/comment interactions |
| Header stories strip is non-virtualized | `src/pages/stories-feed/ui/StoriesFeedPage.tsx` | Horizontal `ScrollView` mounts all items | Medium-High | Replace with horizontal `FlashList`/`FlatList` + stable item renderer | Yes (next pass) | Better memory and startup scroll smoothness |
| Archive grid press path can block UI | `src/pages/stories-archive/ui/StoriesArchivePage.tsx` | `ensureAllPagesLoaded()` is triggered before viewer open | High | Open viewer from current loaded page first, continue paging in background | Already migrated list; behavior fix pending | Reduced tap-to-open latency, fewer stalls |
| Search rows are moderate complexity but still rerender on query churn | `src/pages/search/ui/SearchPage.tsx` | Frequent filter updates + row render closure | Medium | Keep memoized `renderItem`; optionally memoize row component | Already migrated | Stable fast search scrolling under typing |
| Messages inbox lists are nested under parent scroll | `src/pages/messages/ui/Messages.tsx` | Two `FlatList` with `scrollEnabled={false}` inside outer scrolling container | High | Flatten into single virtualized list structure before any list migration | No (until structure fixed) | Significant reduction in wasted mounts/renders |
| Message thread has high realtime pressure | `src/pages/message-thread/ui/MessageThreadPage.tsx` | Frequent message/reaction updates with complex row rendering | High | Stabilize row props + measure; optional FlashList after profiling | Candidate (phase after row stabilization) | Better long-thread FPS and reduced dropped frames |
| Bookings list lacks tuning for large datasets | `src/pages/bookings/ui/BookingsPage.tsx` | Basic `FlatList` setup with limited virtualization tuning | Medium | Add `initialNumToRender/maxToRenderPerBatch/windowSize`, memoized row | Optional | Better consistency on large booking history |
| Home horizontal lists use inline item renderers | `src/pages/home/ui/HomePage.tsx` | Inline render functions and no size estimation | Medium | Memoize item renderers, consider FlashList only if metrics show hitching | Optional low priority | Small CPU reduction on home interactions |

## Rerender Risk Matrix (Event-Based)

| Screen/list | Like/interaction | Pagination | Navigation return | Realtime updates | Risk |
|---|---:|---:|---:|---:|---|
| Feed main list | High | Medium | Medium | Medium | High |
| Stories archive grid | Low | High | Medium | Low | Medium-High |
| Search results | Low | Low | Low | Low | Medium (typing-driven) |
| Messages inbox lists | Medium | Low | Medium | High | High |
| Message thread | Medium | Medium | Medium | High | High |

## Migration Shortlist (Critical Only)

1. `stories-feed` (done) -> stabilize row memo boundaries.
2. `stories-archive` grid (done) -> fix blocking open path.
3. `search` (done) -> verify typed filtering under stress.
4. `message-thread` (candidate) -> only after row prop stabilization and measurements.

## Android Release Measurement Checklist (Before/After)

- Device: same model, same OS build, battery >50%, thermal normalized.
- Build: release, production JS bundle.
- Repeat each scenario 3 times and use median.

### Scenarios

1. Feed open + 60s continuous scroll + 20 like taps.
2. Stories archive open + 30s scroll + open viewer from mid-grid.
3. Search typing 10 queries + long result scroll.
4. Messages inbox open + thread open + realtime message receive.

### Metrics to capture

- FPS average / p95
- Dropped frames count
- Hitch count (jank events)
- JS thread spikes
- Memory peak (MB)
- Time to first interactive list paint (ms)

## Baseline/Result Template

| Scenario | Metric | Before | After | Delta | Notes |
|---|---|---:|---:|---:|---|
| Feed scroll + like | FPS avg |  |  |  |  |
| Feed scroll + like | Dropped frames |  |  |  |  |
| Feed scroll + like | Memory peak (MB) |  |  |  |  |
| Archive grid | FPS avg |  |  |  |  |
| Archive grid | Tap-to-viewer latency (ms) |  |  |  |  |
| Search typing + scroll | FPS avg |  |  |  |  |
| Messages/thread | FPS avg |  |  |  |  |

## Regression Validation Gate

- UX parity: visual behavior and navigation unchanged.
- Functional parity: feed/story/search/messages actions still correct.
- Performance acceptance:
  - no regression in FPS or dropped frames,
  - no memory peak increase >10% in audited scenarios,
  - no increased interaction latency.
