# Performance Report (Phase 1)

## Baseline Context

- Target scenario: Android release build, cold start + first render (`Home`/`Feed` entry paths).
- Profiling mode in this iteration: static production-readiness audit + startup-path cost analysis from code.
- Runtime counters to validate after merge:
  - TTF (time to first frame)
  - TTI (time to interactive)
  - startup network request count + payload size
  - JS thread busy time in first 3-5s
  - memory snapshot during first 10s

## Findings

| Issue | File location | Root cause | Severity | Recommended fix | Estimated impact |
|---|---|---|---|---|---|
| Splash-gated startup blocks first paint | `App.tsx` | `initI18n()` + `hasSeenPermissionsIntro()` are awaited before `ready=true` and `SplashScreen.hide()` | High | Keep only critical startup gate, move non-critical init to post-first-render | Faster first paint, lower startup latency variance |
| Eager navigation imports inflate startup JS work | `src/navigation/AppNavigator.tsx`, `src/navigation/BrowseFlowScreens.tsx` | Many heavy screens are imported synchronously in root navigation graph | High | Lazy-load heavy routes via `getComponent` boundaries | Lower JS parse/eval on cold start |
| Missing global React Query defaults causes frequent refetch | `src/app/providers/AppProviders.tsx` | `new QueryClient()` has no `defaultOptions` (`staleTime`, `gcTime`, mount/focus refetch behavior) | High | Add safe global cache defaults for read-heavy queries | Fewer startup/background refetches |
| Startup feed query key includes `page` and re-fetches large windows | `src/entities/post/api/usePostsFeed.ts`, `src/entities/story/api/useStoriesFeed.ts` | `queryKey` changes by page and fetch limit grows as `page * window`, causing repeated refetch of old data | High | Move to `useInfiniteQuery` with stable key and incremental range fetch | Significant network and CPU reduction while scrolling |
| Business cards query over-fetches columns and rows | `src/entities/business-card/api/useBusinessCards.ts` | `select("*")` and no limit for startup usage | High | Select only required fields and apply safe page cap | Reduced payload and deserialization time |
| Unread notifications computed client-side from full list | `src/entities/notification/api/useNotifications.ts` | `useUnreadCount` fetches all rows then filters in JS | Medium | Query unread count directly from DB (`head/count`) | Less network + JS filtering work |
| Broad invalidation patterns trigger refetch storms | `src/entities/story/api/useCreateStory.ts`, `src/entities/story/api/useReactToStory.ts`, `src/entities/story/api/useReplyToStory.ts`, `src/entities/post/api/useCreatePost.ts`, `src/entities/post/api/useReactToPost.ts`, `src/entities/post/api/useCreatePostComment.ts` | Invalidating root keys like `["stories"]` / `["posts"]` refreshes unrelated queries | High | Narrow invalidation keys to affected scopes; keep targeted keys hot | Lower redundant network + rerenders |
| Story viewer hook returns unstable object | `src/entities/story/api/useStoryViewer.ts` | Hook returns a fresh object each render, invalidating deps in consumers | High | Memoize returned API object with `useMemo` | Fewer cascaded rerenders in viewers |
| Feed story viewer timer has no cleanup | `src/pages/feed-story-viewer/ui/FeedStoryViewerPage.tsx` | `setTimeout` for copied state can run after unmount | Medium | Track timeout in ref and clear in cleanup | Lower leak/race risk and state-after-unmount warnings |
| Story viewer auth redirect uses non-cleaned timeout | `src/pages/story-viewer/ui/StoryViewerPage.tsx` | `setTimeout(..., 0)` executes even if screen unmounts quickly | Medium | Replace with `InteractionManager.runAfterInteractions` + cancellable handle | Safer navigation timing and less post-unmount work |
| Archive payload recomputed on every render | `src/entities/story/api/useMyArchivedStories.ts` | IIFE recomputes `composeArchivedStoriesPayload` without memoization | Medium | Memoize archive payload and `ensureAllPagesLoaded` callback | Reduced CPU churn in archive subtree |
| Stories header in feed uses non-virtualized horizontal `ScrollView` | `src/pages/stories-feed/ui/StoriesFeedPage.tsx` | All story bubbles render at once in header | Medium | Move to horizontal `FlatList` and memoized item renderer | Better scrolling stability and lower memory for large strips |

## Priority Order For Refactor

1. Startup stabilization (`App.tsx`, navigation lazy boundaries, QueryClient defaults).
2. Startup network load reduction (`useBusinessCards`, `useNotifications`, targeted invalidations).
3. Render/thread pressure hardening (`useStoryViewer`, viewer timer cleanup, archive memoization).
4. Feed header virtualization and render isolation improvements.

## Regression Guards

- No business-flow changes in auth, posting, story viewing, comments, or navigation paths.
- Preserve existing route names and params contracts.
- Keep refactors local to listed files and avoid unrelated rewrites.
