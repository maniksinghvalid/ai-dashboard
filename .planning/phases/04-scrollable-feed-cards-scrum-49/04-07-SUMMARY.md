---
phase: 04-scrollable-feed-cards-scrum-49
plan: 07
subsystem: feed-widgets
tags: [scrum-49, news-widget, scrollable, tdd, d1, d9]
requires:
  - 04-02 (MAX_FEED_ITEMS constant)
  - 04-03 (WidgetCard scrollable + maxBodyHeight contract)
provides:
  - "NewsWidget caps rendered rows at MAX_FEED_ITEMS (15)"
  - "NewsWidget wires WidgetCard scrollable={true} + maxBodyHeight=max-h-[320px] on populated branch"
affects:
  - components/widgets/NewsWidget.tsx
  - components/widgets/__tests__/NewsWidget.test.tsx
tech_stack:
  added: []
  patterns:
    - "Render-time slice cap (no fetcher edits — D1)"
    - "Conditional scrollable wiring (populated branch only — D3 backward compat)"
key_files:
  created:
    - components/widgets/__tests__/NewsWidget.test.tsx
  modified:
    - components/widgets/NewsWidget.tsx
decisions:
  - "D1 (cap layer): slice at render in NewsWidget, fetchers untouched"
  - "D9 (badge preservation): badge expression `${count} new` byte-unchanged, live array length 1..15"
  - "Per-widget scrollable wiring conditioned on Array.isArray(items) && items.length > 0 && !isLoading && !error so loading/error/empty branches still use the non-scrollable wrapper"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-05-14"
  tasks: 2
  files_created: 1
  files_modified: 1
  test_count: 5
  total_suite: "115/115 passing"
---

# Phase 4 Plan 7: NewsWidget — MAX_FEED_ITEMS cap + scrollable wiring (SCRUM-49) Summary

**One-liner:** `NewsWidget` now slices at `MAX_FEED_ITEMS` (15) and passes `scrollable + maxBodyHeight="max-h-[320px]"` to `WidgetCard` on the populated branch; 5 render-time tests prove D1 + D9 + D3 contracts; `lib/api/news.ts` byte-unchanged.

## Tasks Executed

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Author NewsWidget.test.tsx (RED) | tdd | `b3a6b26` | `components/widgets/__tests__/NewsWidget.test.tsx` (new) |
| 2 | Rewire NewsWidget.tsx (GREEN) | tdd | `32365cb` | `components/widgets/NewsWidget.tsx` |

## NewsWidget.tsx Diff

```diff
diff --git a/components/widgets/NewsWidget.tsx b/components/widgets/NewsWidget.tsx
@@ -1,4 +1,5 @@
 import type { NewsItem } from "@/lib/types";
+import { MAX_FEED_ITEMS } from "@/lib/constants";
 import { WidgetCard } from "@/components/widgets/WidgetCard";
 import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
 import { formatRelativeTime } from "@/lib/utils/format";
@@ -71,6 +72,8 @@ export function NewsWidget({
       title="AI News"
       badge={count > 0 ? `${count} new` : undefined}
       stale={stale}
+      scrollable={Array.isArray(items) && items.length > 0 && !isLoading && !error ? true : undefined}
+      maxBodyHeight={Array.isArray(items) && items.length > 0 && !isLoading && !error ? "max-h-[320px]" : undefined}
     >
       {isLoading ? (
         <WidgetSkeleton lines={5} />
@@ -84,7 +87,7 @@ export function NewsWidget({
         </p>
       ) : (
         <div>
-          {items.slice(0, 5).map((item, i) => (
+          {items.slice(0, MAX_FEED_ITEMS).map((item, i) => (
             <NewsRow key={`${item.link}-${i}`} item={item} />
           ))}
         </div>
```

## Test Count

5 new tests in `components/widgets/__tests__/NewsWidget.test.tsx`:

1. **D1 cap (30 → 15):** `getAllByRole("link").length === 15` with 30 fabricated items.
2. **D9 happy path (8 items):** rendered text contains `8 new`.
3. **D9 at-cap (15 items):** rendered text contains `15 new`.
4. **Scrollable wiring on populated branch:** `role="region"` with `aria-label="AI News feed, scrollable"` present.
5. **Empty branch — no scrollable:** `items={[]}` renders no region; `No news available` text present.

RED-then-GREEN sequence:
- Task 1 RED: 2 of 5 tests failed (Test 1 cap at 5 not 15; Test 4 region absent).
- Task 2 GREEN: all 5 tests pass; full suite 115/115; tsc clean; lint clean.

## Layer Discipline Confirmation

```bash
$ git diff --stat HEAD~2..HEAD lib/api/news.ts
(empty — fetcher untouched, D1 honored)
```

Verified across both commits (test commit b3a6b26 and rewire commit 32365cb) that `lib/api/news.ts` is byte-identical to its pre-plan state.

## Deviations from Plan

None — plan executed exactly as written. Plan called for `// @vitest-environment jsdom` pragma, `makeNews` fabricator, populated/empty branch assertions, and the three-line edit to NewsWidget; all delivered verbatim.

## Decisions Made

- **Conditional wiring style:** `scrollable={... ? true : undefined}` (not `? true : false`) so the prop is omitted entirely on non-populated branches. Matches the WidgetCard contract from plan 04-03 where `scrollable` is optional and `undefined` triggers the existing non-scrollable wrapper.
- **`maxBodyHeight="max-h-[320px]"`:** picked to match the value used in the WidgetCard test suite and the existing scrollable contract; D7 leaves exact pixel heights to implementation review.
- **D9 badge expression byte-unchanged:** the existing `count > 0 ? \`${count} new\` : undefined` expression is preserved verbatim — no rounding to `MAX_FEED_ITEMS`, since D9 explicitly mandates live array length.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. The plan's threat register (T-04-supply-chain) was n/a; no new dependencies introduced. No threat flags surfaced.

## Known Stubs

None. Both files are fully wired against real data flow: `NewsWidget` consumes the existing `NewsItem[]` from `useDashboard()`, `MAX_FEED_ITEMS` already exists as a shared constant (plan 04-02), and `WidgetCard` already supports the scrollable contract (plan 04-03).

## Self-Check: PASSED

- `components/widgets/__tests__/NewsWidget.test.tsx` exists: **FOUND**
- `components/widgets/NewsWidget.tsx` modified (slice → MAX_FEED_ITEMS, scrollable wired): **FOUND**
- Commit `b3a6b26` (test RED) in `git log`: **FOUND**
- Commit `32365cb` (feat GREEN) in `git log`: **FOUND**
- `lib/api/news.ts` byte-unchanged (`git diff --stat` empty): **CONFIRMED**
- 5/5 NewsWidget tests pass: **CONFIRMED**
- Full suite 115/115 pass, tsc clean, lint clean: **CONFIRMED**
