---
phase: 04-scrollable-feed-cards-scrum-49
plan: 05
subsystem: components/widgets
tags: [reddit, widget, scrollable, render-cap, tdd]
requires:
  - lib/constants.ts (MAX_FEED_ITEMS, from Plan 02)
  - components/widgets/WidgetCard.tsx (scrollable + maxBodyHeight props, from Plan 03)
provides:
  - components/widgets/RedditWidget.tsx (rewired)
  - components/widgets/__tests__/RedditWidget.test.tsx (new)
affects:
  - none (zero changes to lib/api/reddit.ts, trending.ts, hero.ts)
tech-stack:
  added: []
  patterns:
    - Render-time slice via posts.slice(0, MAX_FEED_ITEMS)
    - Conditional scrollable/maxBodyHeight on populated branch (undefined fallthrough on loading/error/empty)
    - Vitest jsdom pragma per-file (no global config change)
    - React Testing Library + afterEach(cleanup)
key-files:
  created:
    - components/widgets/__tests__/RedditWidget.test.tsx
  modified:
    - components/widgets/RedditWidget.tsx
decisions:
  - Used `undefined` (not `false`) for the inactive branch so WidgetCard's optional-prop semantics are preserved verbatim (parity with Plan 04 YouTubeWidget pattern from the plan action spec)
  - Per-file `// @vitest-environment jsdom` pragma — no vitest.config.ts mutation needed
metrics:
  duration_seconds: ~120
  completed_date: 2026-05-14
  tasks_completed: 2
  files_touched: 2
  tests_added: 4
  full_suite: "114/114 passing"
---

# Phase 04 Plan 05: RedditWidget Scrollable Rewire Summary

Rewired `RedditWidget.tsx` to slice at `MAX_FEED_ITEMS` (15, up from hardcoded 3) and pass `scrollable` + `maxBodyHeight="max-h-[320px]"` to `WidgetCard` on the populated branch only — zero changes to `lib/api/reddit.ts`.

## Tasks executed

| # | Name | Type | Tests | Commit |
| - | ---- | ---- | ----- | ------ |
| 1 | Author RedditWidget.test.tsx (RED) | test (TDD RED) | 4 added; 2 failed (1 cap + 2 region) before impl, satisfying RED gate | `26c371c` |
| 2 | Rewire RedditWidget.tsx (GREEN) | feat | All 4 pass; full suite 114/114 | `f5d17d3` |

## RedditWidget.tsx diff

```diff
--- a/components/widgets/RedditWidget.tsx
+++ b/components/widgets/RedditWidget.tsx
@@ -1,4 +1,5 @@
 import type { RedditPost } from "@/lib/types";
+import { MAX_FEED_ITEMS } from "@/lib/constants";
 import { WidgetCard } from "@/components/widgets/WidgetCard";
 import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
 import { formatRelativeTime } from "@/lib/utils/format";
@@ -45,6 +46,16 @@ export function RedditWidget({
       title="Reddit"
       badge="r/ML · r/AI"
       stale={stale}
+      scrollable={
+        Array.isArray(posts) && posts.length > 0 && !isLoading && !error
+          ? true
+          : undefined
+      }
+      maxBodyHeight={
+        Array.isArray(posts) && posts.length > 0 && !isLoading && !error
+          ? "max-h-[320px]"
+          : undefined
+      }
     >
       {isLoading ? (
         <WidgetSkeleton lines={3} />
@@ -58,7 +69,7 @@ export function RedditWidget({
         </p>
       ) : (
         <div>
-          {posts.slice(0, 3).map((post) => (
+          {posts.slice(0, MAX_FEED_ITEMS).map((post) => (
             // post.url always has a value (normalizer falls back), so it's a
             // safe key even in the unlikely event an Atom entry had no <id>.
             <PostRow key={post.id || post.url} post={post} />
```

Net: `+12 / -1` in `RedditWidget.tsx` (1 import + 10 lines of scrollable/maxBodyHeight wiring + 1 slice swap).

## Tests added (4)

`components/widgets/__tests__/RedditWidget.test.tsx` (79 LOC, `// @vitest-environment jsdom`):

1. **Test 1 (D1):** Given 30 fabricated `RedditPost[]` items, the widget renders exactly 15 `<a>` rows (asserted via `screen.getAllByRole("link").length === 15`).
2. **Test 2 (D3):** Given 5 posts, `role="region"` with `aria-label="Reddit feed, scrollable"` is present (asserts the scrollable wiring reaches WidgetCard's populated branch).
3. **Test 3 (D3 backward compat):** Given `posts={[]}`, no `role="region"` is rendered; the text `No posts available` is rendered (assures the empty branch stays non-scrollable).
4. **Test 4 (badge preservation):** Static text `r/ML · r/AI` is rendered (D9 contract).

RED gate evidence: pre-impl `npx vitest run` reported `2 failed | 2 passed (4)` — Tests 1 and 2 failed on the old `slice(0, 3)` + missing scrollable wiring; Tests 3 (empty branch) and 4 (badge) already passed because those code paths were already correct. GREEN gate evidence: post-impl run reported `4 passed (4)`.

## Layer-discipline confirmation

```
$ git diff --stat HEAD~2..HEAD -- lib/api/reddit.ts
(empty — no changes)

$ git rev-parse HEAD:lib/api/reddit.ts
35d6baec52723c10bddbf593f7bc07584caab5f0   # byte-identical to merge base
```

Zero modifications to `lib/api/reddit.ts`. The fetcher still returns the full pre-slice array, so `lib/api/trending.ts` and `lib/api/hero.ts` continue to consume all ~125 posts unaffected (D1 contract).

## Verification commands run

```
npx vitest run components/widgets/__tests__/RedditWidget.test.tsx  →  Tests  4 passed (4)
npx tsc --noEmit                                                    →  exit 0 (no output)
npm run lint -- --quiet                                             →  ✔ No ESLint warnings or errors
npm test                                                            →  Test Files 14 passed (14), Tests 114 passed (114)
```

## Acceptance criteria — all met

Task 1:
- [x] File `components/widgets/__tests__/RedditWidget.test.tsx` exists
- [x] First line is exactly `// @vitest-environment jsdom`
- [x] `grep -c 'getAllByRole("link")'` = 1
- [x] `grep -c '"Reddit feed, scrollable"'` = 1
- [x] Pre-impl `npx vitest run` exit code != 0 (2 failed)

Task 2:
- [x] `npx vitest run components/widgets/__tests__/RedditWidget.test.tsx` exits 0
- [x] `grep -c 'posts.slice(0, MAX_FEED_ITEMS)'` = 1
- [x] `grep -c 'posts.slice(0, 3)'` = 0
- [x] `grep -cE 'import.*MAX_FEED_ITEMS.*@/lib/constants'` = 1
- [x] `grep -c 'maxBodyHeight='` = 1
- [x] `grep -c 'scrollable='` = 1
- [x] `grep -c 'badge="r/ML · r/AI"'` = 1
- [x] `npm test` exits 0
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run lint` exits 0

## must_haves — all confirmed

- [x] RedditWidget renders at most MAX_FEED_ITEMS (15) post rows when given more than 15 posts (Test 1)
- [x] The widget passes scrollable + maxBodyHeight="max-h-[320px]" to WidgetCard on the populated branch (Test 2 + diff)
- [x] The static badge `r/ML · r/AI` is preserved unchanged (Test 4 + diff line 49 unchanged)
- [x] `lib/api/reddit.ts` is not modified by this plan (`git diff --stat` empty, hash byte-identical)

## Requirements addressed

- **D1** — 15-item cap enforced at widget render layer (not fetcher).
- **D7** — `maxBodyHeight="max-h-[320px]"` chosen as 320px to match Plans 03–07 column-balance pattern.
- **SC-1** — Plan 04-05 ships in Wave 2 alongside Plans 04, 06, 07 (parallel-safe, disjoint files).
- **SC-6** — Render-time test coverage added (4 tests).

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

- RED commit (`26c371c`, `test(04-05)`) — failing tests committed first.
- GREEN commit (`f5d17d3`, `feat(04-05)`) — implementation committed after RED, all tests pass.
- REFACTOR commit — not needed (10-line slice + prop wiring; no cleanup justified).

Gate sequence verified via `git log --oneline -3`.

## Self-Check: PASSED

- [x] `components/widgets/__tests__/RedditWidget.test.tsx` exists (79 LOC)
- [x] `components/widgets/RedditWidget.tsx` modified (verified via `grep` on MAX_FEED_ITEMS / scrollable / maxBodyHeight)
- [x] Commit `26c371c` found in `git log` (test RED)
- [x] Commit `f5d17d3` found in `git log` (feat GREEN)
- [x] `lib/api/reddit.ts` byte-unchanged (`git rev-parse HEAD:lib/api/reddit.ts` == `35d6baec...`, matches phase merge base)
