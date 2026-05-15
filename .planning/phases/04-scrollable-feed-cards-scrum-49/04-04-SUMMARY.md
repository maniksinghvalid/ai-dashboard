---
phase: 04-scrollable-feed-cards-scrum-49
plan: 04
subsystem: components/widgets
tags:
  - scrum-49
  - scrollable-feeds
  - youtube-widget
  - tdd
  - wave-2
dependency_graph:
  requires:
    - 04-02 (MAX_FEED_ITEMS constant)
    - 04-03 (WidgetCard scrollable + maxBodyHeight props)
  provides:
    - YouTubeWidget render-time 15-item cap
    - YouTubeWidget scrollable WidgetCard wiring on populated branch
  affects:
    - components/widgets/YouTubeWidget.tsx
    - components/widgets/__tests__/YouTubeWidget.test.tsx
tech_stack:
  added: []
  patterns:
    - widget-level slice cap via MAX_FEED_ITEMS (D1, D2)
    - conditional scrollable + maxBodyHeight props on populated branch only (D3 + UI-SPEC)
    - vitest + @testing-library/react + jsdom pragma render-time tests (Plan 03 pattern)
key_files:
  created:
    - components/widgets/__tests__/YouTubeWidget.test.tsx
  modified:
    - components/widgets/YouTubeWidget.tsx
decisions:
  - D1 (LOCKED): cap layer is widget render — videos.slice(0, MAX_FEED_ITEMS)
  - D2 (LOCKED): MAX_FEED_ITEMS imported from @/lib/constants (no hardcoded 15)
  - D3 (LOCKED): scrollable + maxBodyHeight passed only on populated branch via ternaries
  - D9 (LOCKED): badge expression `${count} new` (live array length) preserved verbatim
metrics:
  duration_seconds: 173
  tasks_completed: 2
  files_changed: 2
  tests_added: 5
  tests_total_pass: 115
  completed_date: 2026-05-15
requirements:
  - D1
  - D9
  - SC-1
  - SC-6
  - D7
---

# Phase 4 Plan 4: YouTubeWidget rewire (cap + scrollable wiring) Summary

Rewired `YouTubeWidget` so the render-time slice uses `MAX_FEED_ITEMS` (15) instead of the hard-coded `4`, and the populated branch passes `scrollable` + `maxBodyHeight="max-h-[320px]"` to `WidgetCard` while loading / error / empty branches preserve the existing non-scrollable WidgetCard contract verbatim. Co-authored 5 render-time tests proving the cap, the badge-preservation contract (D9), and the empty-branch non-scrollable behavior.

## Outcomes

- **D1 + D2 LOCKED:** `videos.slice(0, MAX_FEED_ITEMS)` replaces `videos.slice(0, 4)`; `MAX_FEED_ITEMS` is imported from `@/lib/constants`, no hardcoded `15`.
- **D3 LOCKED:** populated branch passes `scrollable={true}` and `maxBodyHeight="max-h-[320px]"` to `WidgetCard`; loading / error / empty branches pass `undefined` for both (byte-identical to today's call for those branches per UI-SPEC).
- **D9 LOCKED:** badge expression `count > 0 ? \`${count} new\` : undefined` preserved verbatim — live array length 1..15, including the at-cap N=15 case.
- **Layer discipline:** `git diff --stat HEAD~..HEAD -- lib/api/youtube.ts` is empty. Fetcher untouched per CONTEXT.md "Out of in-scope artifacts".

## Tasks

| # | Task | Type | Commit | Files |
|---|------|------|--------|-------|
| 1 | Author YouTubeWidget.test.tsx (failing — RED) | test | `319c61f` | `components/widgets/__tests__/YouTubeWidget.test.tsx` |
| 2 | Rewire YouTubeWidget.tsx (GREEN) | feat | `01058af` | `components/widgets/YouTubeWidget.tsx` |

## Tests

5 new tests, all passing post-rewire:

1. **Test 1 (D1 cap to 15):** given 25 videos, exactly 15 `<a role="link">` rows render (`screen.getAllByRole("link").length === 15`).
2. **Test 2 (D9 badge — happy path):** given 7 videos, the badge text `"7 new"` is rendered.
3. **Test 3 (D9 badge — at the cap):** given 15 videos, the badge reads `"15 new"` (live array length, not post-cap count — D9).
4. **Test 4 (D3 scrollable wiring):** given 5 videos, a `role="region"` element with `aria-label="YouTube feed, scrollable"` is rendered (proves `scrollable` is passed through).
5. **Test 5 (empty branch):** given `[]` videos, no `role="region"` is rendered and the `"No videos available"` empty-state message is rendered (proves `scrollable` is NOT passed on the empty branch).

**RED proof (pre-rewire):** Tests 1 and 4 failed against the un-modified `YouTubeWidget.tsx` (cap=4 → 4 links not 15; no `role="region"` because `scrollable` was not passed). Tests 2, 3, 5 passed against the un-modified code — acceptable per the plan's done criterion ("Tests 2 and 5 may pass against today's code — that is fine for RED state"; Test 3 also happens to pass because its assertion targets the badge text only, which already used `count` not the post-cap length).

**GREEN proof:** all 5 YouTubeWidget tests pass after the rewire; full repo suite remains green (14 files, **115 / 115 tests**).

## Verification

- `npx vitest run components/widgets/__tests__/YouTubeWidget.test.tsx` → 5 / 5 pass.
- `npm test` → 14 files / 115 tests pass.
- `npx tsc --noEmit` → exit 0.
- `npm run lint -- --quiet` → "No ESLint warnings or errors".
- `git diff --stat HEAD~..HEAD -- lib/api/youtube.ts` → empty (layer discipline holds).

## YouTubeWidget.tsx Diff (Task 2)

```diff
 import Image from "next/image";
 import type { Video } from "@/lib/types";
+import { MAX_FEED_ITEMS } from "@/lib/constants";
 import { WidgetCard } from "@/components/widgets/WidgetCard";
 import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
 import { formatRelativeTime } from "@/lib/utils/format";
@@
   const count = videos?.length ?? 0;
+  const isPopulated =
+    Array.isArray(videos) && videos.length > 0 && !isLoading && !error;

   return (
     <WidgetCard
@@
       title="YouTube"
       badge={count > 0 ? `${count} new` : undefined}
       stale={stale}
+      scrollable={isPopulated ? true : undefined}
+      maxBodyHeight={isPopulated ? "max-h-[320px]" : undefined}
     >
@@
-          {videos.slice(0, 4).map((video) => (
+          {videos.slice(0, MAX_FEED_ITEMS).map((video) => (
             <VideoItem key={video.id} video={video} />
           ))}
```

Net change: **+6 / −1 lines**.

## Layer Discipline Confirmation

```
$ git diff --stat HEAD~..HEAD -- lib/api/youtube.ts
(empty — file not in commit)
```

`lib/api/youtube.ts` is byte-unchanged by this plan, as required by CONTEXT.md "Out of in-scope artifacts" (fetcher must not be touched; `lib/api/trending.ts` and `lib/api/hero.ts` continue to consume the full pre-slice array of ~25 YouTube videos).

## Deviations from Plan

None — plan executed exactly as written. The plan's "alternative" path (duplicating the WidgetCard JSX) was rejected in favor of the plan's recommended "single outer WidgetCard with ternary props" path. The ternaries collapse to `undefined` on loading / error / empty branches, which is byte-identical to today's WidgetCard call for those branches (the `scrollable` and `maxBodyHeight` props are optional in WidgetCard's signature — Plan 03 contract).

A small implementation tidiness choice: extracted the populated-branch predicate into `const isPopulated = Array.isArray(videos) && videos.length > 0 && !isLoading && !error;` to avoid duplicating the four-clause expression twice in the JSX. This matches the plan's "Simplest path" guidance verbatim — just lifted into a named const for readability.

## Authentication Gates

None.

## Known Stubs

None. The widget is fully wired:
- Populated branch reads from the live `videos: Video[]` prop and renders up to 15 rows.
- Badge reads live array length.
- Empty / loading / error paths render existing copy verbatim.

## Threat Flags

None. Pure rendering change; no new network endpoints, auth paths, file access, or schema changes.

## Self-Check: PASSED

- **File `components/widgets/__tests__/YouTubeWidget.test.tsx` exists:** FOUND.
- **File `components/widgets/YouTubeWidget.tsx` exists and modified:** FOUND.
- **Commit `319c61f` exists:** FOUND.
- **Commit `01058af` exists:** FOUND.
- **`lib/api/youtube.ts` unchanged in this plan's commits:** confirmed via `git diff --stat HEAD~..HEAD -- lib/api/youtube.ts` (empty).
- **All 5 YouTubeWidget tests pass + full 115-test suite green + tsc + lint clean:** confirmed.
