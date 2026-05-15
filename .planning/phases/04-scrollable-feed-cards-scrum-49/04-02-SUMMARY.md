---
phase: 04-scrollable-feed-cards-scrum-49
plan: 02
subsystem: constants
tags:
  - constants
  - cap
  - test
requirements_satisfied:
  - D2
  - SC-1
dependency_graph:
  requires:
    - 01 (Vitest + jsdom setup — vitest must be runnable; this plan's tests are pure-data .test.ts so they run under the existing node environment regardless)
  provides:
    - MAX_FEED_ITEMS named export from lib/constants.ts (single source of truth for the 15-item widget render cap)
  affects:
    - 04-03 (WidgetCard scrollable extension — does not import this constant)
    - 04-04, 04-05, 04-06, 04-07 (YouTube/Reddit/X/News widget slice rewires — Wave 2 consumers of MAX_FEED_ITEMS)
tech_stack:
  added: []
  patterns:
    - "Centralized render-layer constants — alongside CACHE_KEYS / CACHE_MAX_AGE in lib/constants.ts"
key_files:
  created: []
  modified:
    - lib/constants.ts
    - lib/constants.test.ts
decisions:
  - "Followed D2 (LOCKED) verbatim: MAX_FEED_ITEMS = 15 exported from lib/constants.ts; no widget file modified by this plan"
  - "Followed plan's literal append-point: after the CACHE_MAX_AGE `as const` block, separated by one blank line"
  - "No Math.min wrapper added — Array.prototype.slice(0, n) already clamps to length, per RESEARCH.md 'Specifics'"
metrics:
  duration_seconds: 153
  completed: 2026-05-15
  tasks_completed: 2
  files_modified: 2
  commits: 2
---

# Phase 4 Plan 02: MAX_FEED_ITEMS Constant Summary

**One-liner:** Exported `MAX_FEED_ITEMS = 15` from `lib/constants.ts` (the D2 locked source-of-truth for the per-widget render cap) and locked the value with two Vitest assertions in `lib/constants.test.ts`.

## What Shipped

### Task 1: Add `MAX_FEED_ITEMS = 15` to `lib/constants.ts`

Appended six lines (4-line block comment + export) after the existing `CACHE_MAX_AGE` `as const;` block:

```ts
// SCRUM-49 (D2): Per-widget render cap for the four feed widgets
// (YouTube, Reddit, X/Twitter, News). Enforced at the widget render layer,
// NOT in the fetchers — lib/api/trending.ts and lib/api/hero.ts consume the
// full pre-slice arrays. Do not import this in lib/api/*.
export const MAX_FEED_ITEMS = 15;
```

**Commit:** `6e3988b` — `feat(04-02): add MAX_FEED_ITEMS = 15 constant for widget render cap`

### Task 2: Extend `lib/constants.test.ts` with a `MAX_FEED_ITEMS` assertion suite

1. Extended the existing top-of-file import:
   - **From:** `import { SUBREDDITS, TWITTER_USERS, YOUTUBE_CHANNELS } from "@/lib/constants";`
   - **To:** `import { MAX_FEED_ITEMS, SUBREDDITS, TWITTER_USERS, YOUTUBE_CHANNELS } from "@/lib/constants";`

2. Appended a new `describe("MAX_FEED_ITEMS", ...)` block at the end of the file (after the `YOUTUBE_CHANNELS` describe) with two `it(...)` cases:
   - `equals 15` → `expect(MAX_FEED_ITEMS).toBe(15)`
   - `is a positive integer` → `Number.isInteger` + `> 0`

   The block carries a 2-line comment noting the value is locked by CONTEXT.md D2 and that the assertion must move in lockstep with any legitimate cap change.

**Commit:** `8c13dcf` — `test(04-02): assert MAX_FEED_ITEMS === 15 in constants test suite`

## Test-Suite Delta

| Metric | Before | After | Delta |
|---|---|---|---|
| Tests in `lib/constants.test.ts` | 12 | 14 | **+2** |
| Total project tests (`npm test`) | 102 (per Plan 04-01 SUMMARY baseline) | 104 | **+2** |
| Test files | 12 | 12 | 0 |

`npm test` exits 0; `npx tsc --noEmit` exits 0.

**Plan-arithmetic note:** The plan's `<done>` clause for Task 2 said "totalling 13 cases in this file." The actual baseline was 12 cases (4 SUBREDDITS + 4 TWITTER_USERS + 4 YOUTUBE_CHANNELS), so adding 2 cases yields **14** in this file, not 13. The assertion count (+2 new) was implemented as specified; only the plan's running-total arithmetic was off by one. Documented here for traceability; not a behavioral deviation.

## D2 Satisfaction

CONTEXT.md D2 (LOCKED) requires:

> Export `MAX_FEED_ITEMS = 15` from `lib/constants.ts` alongside the existing `CACHE_KEYS` / `CACHE_MAX_AGE` exports. No hardcoded `15` allowed in widget files.

**Satisfied:**
- ✅ Exported `MAX_FEED_ITEMS` from `lib/constants.ts`.
- ✅ Value is `15`.
- ✅ Co-located with `CACHE_KEYS` / `CACHE_MAX_AGE` (immediately after, separated by one blank line).
- ✅ This plan does NOT modify any widget file, so no widget-file `15` literal was introduced by this plan. (Wave 2 plans 04-04..07 will rewire `slice(0, 4)` / `slice(0, 3)` / `slice(0, 5)` → `slice(0, MAX_FEED_ITEMS)`.)

## Layer Discipline (SC-1 invariant)

This plan's git diff is constrained to two files. The forbidden surface (`lib/api/{youtube,reddit,twitter,news,trending,hero}.ts`) was verified untouched by this plan:

```bash
$ git diff --stat HEAD~2..HEAD -- \
    lib/api/youtube.ts lib/api/reddit.ts lib/api/twitter.ts \
    lib/api/news.ts   lib/api/trending.ts lib/api/hero.ts
# (empty — zero files affected)
```

## Deviations from Plan

**None.** The plan executed exactly as written. The only callout is a documentation drift in the plan's running-test-count math (plan said "13 total in this file," actual is 14) — see the Test-Suite Delta note above. This is a plan-doc arithmetic note, not a behavior deviation: the requested +2 assertions, the requested `describe` block, and the requested import edit all landed verbatim.

No Rule 1 (bug fixes), no Rule 2 (missing critical functionality), no Rule 3 (blocking issues), no Rule 4 (architectural escalations) triggered.

## Verification Run

```
npx vitest run lib/constants.test.ts
  Test Files  1 passed (1)
  Tests       14 passed (14)
  Duration    334ms
  Exit        0

npm test
  Test Files  12 passed (12)
  Tests       104 passed (104)
  Duration    1.12s
  Exit        0

npx tsc --noEmit
  Exit        0

grep -c 'export const MAX_FEED_ITEMS = 15;' lib/constants.ts → 1
grep -c 'describe("MAX_FEED_ITEMS"'      lib/constants.test.ts → 1
grep -c 'expect(MAX_FEED_ITEMS).toBe(15)' lib/constants.test.ts → 1
grep -c '^import.*MAX_FEED_ITEMS'         lib/constants.test.ts → 1
```

## Commits

| # | Hash | Type | Subject |
|---|---|---|---|
| 1 | `6e3988b` | feat | add MAX_FEED_ITEMS = 15 constant for widget render cap |
| 2 | `8c13dcf` | test | assert MAX_FEED_ITEMS === 15 in constants test suite |

## Known Stubs

None. This plan adds a constant and an assertion only — no UI render surface, no data path, no placeholders.

## Self-Check: PASSED

- ✅ `lib/constants.ts` contains `export const MAX_FEED_ITEMS = 15;`
- ✅ `lib/constants.test.ts` imports `MAX_FEED_ITEMS` and asserts `toBe(15)`
- ✅ Commit `6e3988b` exists on this worktree branch (verified via `git log --oneline -3`)
- ✅ Commit `8c13dcf` exists on this worktree branch (verified via `git log --oneline -3`)
- ✅ No forbidden surfaces touched (`lib/api/*` diff is empty)
- ✅ Full test suite green: 104/104

---

*Plan executed under worktree mode (parallel wave 1).*
*Plan owner: orchestrator-spawned `gsd-execute-phase` agent.*
*Worktree branch: `worktree-agent-adbc7d278df10ef49`.*
