---
phase: 04-scrollable-feed-cards-scrum-49
plan: 06
subsystem: components/widgets
tags: [tdd, widget, scrollable, x-twitter]
requirements:
  - D1
  - SC-1
  - SC-6
  - D7
dependency-graph:
  requires:
    - "lib/constants.ts (MAX_FEED_ITEMS=15, landed in 04-01)"
    - "components/widgets/WidgetCard.tsx (scrollable + maxBodyHeight props, landed in 04-02)"
  provides:
    - "XFeedWidget rendering at most MAX_FEED_ITEMS (15) tweet rows"
    - "Scrollable wiring (max-h-[320px]) on populated branch"
    - "Render-time cap test coverage for X / Twitter feed widget"
  affects:
    - "DashboardShell.tsx (XFeedWidget is now scrollable in the right column)"
tech-stack:
  added: []
  patterns:
    - "Render-time slice cap with @/lib/constants MAX_FEED_ITEMS"
    - "Conditional scrollable wiring on populated branch (empty/error/loading branches stay non-scrollable)"
    - "Vitest jsdom pragma (per-file `// @vitest-environment jsdom`)"
key-files:
  created:
    - "components/widgets/__tests__/XFeedWidget.test.tsx"
  modified:
    - "components/widgets/XFeedWidget.tsx"
decisions:
  - "Conditional scrollable/maxBodyHeight gated on `Array.isArray(tweets) && tweets.length > 0 && !isLoading && !error` so the empty/loading/error branches retain the original non-scrollable WidgetCard contract."
  - "Used `max-h-[320px]` per plan — column-balance height tunable in a later review pass per D7."
metrics:
  duration: "~5 min"
  completed: "2026-05-14"
  tasks_completed: 2
  files_changed: 2
  tests_added: 4
---

# Phase 04 Plan 06: XFeedWidget scrollable rewire Summary

Rewired `XFeedWidget.tsx` to cap render at `MAX_FEED_ITEMS` (15) instead of the hardcoded `4` and to pass `scrollable + maxBodyHeight="max-h-[320px]"` to `WidgetCard` on the populated branch. Authored 4 render-time tests that exercise the cap, scrollable wiring, empty branch (no region), and gradient rotation past index 5. `lib/api/twitter.ts` is byte-unchanged — layer discipline preserved.

## Tasks Completed

| Task | Name                                         | Commit  | Files                                                              |
| ---- | -------------------------------------------- | ------- | ------------------------------------------------------------------ |
| 1    | Author XFeedWidget.test.tsx (failing — RED)  | e12f099 | components/widgets/__tests__/XFeedWidget.test.tsx (new)            |
| 2    | Rewire XFeedWidget.tsx (GREEN)               | fba6202 | components/widgets/XFeedWidget.tsx                                 |

## Verification

| Check                                                                  | Result |
| ---------------------------------------------------------------------- | ------ |
| `npx vitest run components/widgets/__tests__/XFeedWidget.test.tsx`     | 4/4 passing |
| `npm test` (full suite)                                                | 114/114 passing |
| `npx tsc --noEmit`                                                     | clean |
| `npm run lint`                                                         | clean (0 warnings, 0 errors) |
| `git diff --stat HEAD~2 HEAD -- lib/api/twitter.ts`                    | **empty** (no changes) |
| `grep -c 'tweets.slice(0, MAX_FEED_ITEMS)' components/widgets/XFeedWidget.tsx` | 1 |
| `grep -c 'tweets.slice(0, 4)' components/widgets/XFeedWidget.tsx`      | 0 |
| `grep -cE 'import.*MAX_FEED_ITEMS.*@/lib/constants' components/widgets/XFeedWidget.tsx` | 1 |
| `grep -c 'maxBodyHeight=' components/widgets/XFeedWidget.tsx`          | 1 |
| `grep -c 'scrollable=' components/widgets/XFeedWidget.tsx`             | 1 |
| `grep -c 'badge="Live feed"' components/widgets/XFeedWidget.tsx`       | 1 |

## XFeedWidget.tsx Diff

Three surgical edits:

1. **New import line** (after the `@/lib/types` import):
   ```ts
   import { MAX_FEED_ITEMS } from "@/lib/constants";
   ```

2. **Slice cap upgraded from 4 → MAX_FEED_ITEMS** (preserves the `(tweet, i) =>` signature and `key={tweet.id}` + `index={i}` props that the gradient rotation depends on):
   ```ts
   {tweets.slice(0, MAX_FEED_ITEMS).map((tweet, i) => (
     <TweetCard key={tweet.id} tweet={tweet} index={i} />
   ))}
   ```

3. **WidgetCard wiring** (conditional on populated branch — empty/loading/error stays non-scrollable):
   ```ts
   <WidgetCard
     icon={...}
     iconBg="#111"
     title="X / Twitter"
     badge="Live feed"
     stale={stale}
     scrollable={Array.isArray(tweets) && tweets.length > 0 && !isLoading && !error ? true : undefined}
     maxBodyHeight={Array.isArray(tweets) && tweets.length > 0 && !isLoading && !error ? "max-h-[320px]" : undefined}
   >
   ```

Static `badge="Live feed"` is preserved per the plan. The gating expression matches the same condition the JSX body uses to switch from `WidgetSkeleton`/error-text/`No tweets available` to the populated rows, so `scrollable` is only `true` on the rows branch.

## Test Count

4 new tests added in `components/widgets/__tests__/XFeedWidget.test.tsx`:

1. **Test 1 (D1 cap to 15):** given 30 fabricated `Tweet[]` items, asserts exactly 15 `<a>` (link) rows are rendered.
2. **Test 2 (SC-1/SC-6 scrollable wiring):** given 5 tweets, asserts a `role="region"` element with `aria-label="X / Twitter feed, scrollable"` is present (delegated to WidgetCard's existing landmark, which interpolates `${title} feed, scrollable`).
3. **Test 3 (empty branch, no scrollable):** given `tweets={[]}`, asserts NO `role="region"` and that "No tweets available" text is rendered (so the empty branch stays in the original non-scrollable WidgetCard layout).
4. **Test 4 (gradient rotation past index 5):** given 12 tweets, asserts all 12 rows render (no throw when `index % 6` wraps for indices 6..11).

RED was confirmed before Task 2: 3 of 4 tests failed against the unmodified widget (cap=4 vs expected 15; no region; cap=4 vs expected 12); only Test 3 (empty branch) passed pre-rewire. After Task 2 all 4 pass.

## Layer Discipline (lib/api/twitter.ts byte-unchanged)

```
$ git diff --stat HEAD~2 HEAD -- lib/api/twitter.ts
(no output)
```

Zero changes to the fetcher. The 15-item cap is enforced exclusively at the render layer (D1), so `lib/api/trending.ts` and `lib/api/hero.ts` continue to consume the full pre-slice fetcher array.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were necessary.

One minor note on test framework choice (not a deviation, just a clarification): the plan instructed standard `vitest + @testing-library/react` imports. The existing `WidgetCard.test.tsx` (the prescribed jsdom-pragma reference) does NOT import `@testing-library/jest-dom`, and `vitest.setup.ts` does not exist in this project — so `toBeInTheDocument()` is unavailable. The test uses `.not.toBeNull()` instead, matching the established codebase pattern.

## TDD Gate Compliance

- RED gate (`test(04-06): ...`) committed at `e12f099` before any implementation change.
- GREEN gate (`feat(04-06): ...`) committed at `fba6202` after RED.
- No REFACTOR commit was needed — the rewire was minimal (3 edits totalling 4 insertions / 1 deletion).

## Known Stubs

None. No placeholders, hardcoded empty values, or unwired components were introduced.

## Threat Flags

None. No new network endpoints, auth paths, file access, or schema changes. The plan's threat register (`T-04-supply-chain`) marks no new dependencies — confirmed: no `package.json` / `package-lock.json` edits in this plan's commits.

## Self-Check: PASSED

Files created:
- FOUND: components/widgets/__tests__/XFeedWidget.test.tsx
- FOUND: .planning/phases/04-scrollable-feed-cards-scrum-49/04-06-SUMMARY.md (this file)

Files modified:
- FOUND: components/widgets/XFeedWidget.tsx (3 edits, +4/-1)

Commits:
- FOUND: e12f099 (Task 1 — test, RED)
- FOUND: fba6202 (Task 2 — feat, GREEN)
