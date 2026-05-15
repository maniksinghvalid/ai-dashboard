---
phase: 04-scrollable-feed-cards-scrum-49
plan: 03
subsystem: frontend / components / widgets
tags:
  - widgetcard
  - scrollable
  - tdd
  - vitest
  - jsdom
  - testing-library
  - a11y
  - focus-visible
  - aria-region
  - bottom-fade

dependency_graph:
  requires:
    - 04-01 (Wave 0 — @testing-library/react@^16, @testing-library/dom@^10, jsdom@^29 devDependencies; vitest.config.ts include glob extended to *.test.{ts,tsx})
  provides:
    - "WidgetCard.tsx with optional scrollable + maxBodyHeight props (D3)"
    - "scroll-aware aria-hidden bottom-fade overlay (D4 + D5)"
    - "focus-visible accent ring on the scroll region (D8)"
    - "byte-identical non-scrollable branch (preserves TrendingWidget/SentimentWidget/HeroStoryCard)"
  affects:
    - components/widgets/WidgetCard.tsx
    - components/widgets/__tests__/WidgetCard.test.tsx (new)
    - vitest.config.ts (plugins: [react()] added)
    - package.json / package-lock.json (+ @vitejs/plugin-react@^4)

tech_stack:
  added:
    - "@vitejs/plugin-react@^4.7.0 (devDependency) — required to transform .tsx test files; Wave 0 missed this"
  patterns:
    - "Per-file Vitest environment pragma: `// @vitest-environment jsdom` (Pattern 1 from 04-RESEARCH.md)"
    - "Inline scroll-at-bottom hook with useRef + useEffect + passive scroll listener (Pattern 2 from 04-RESEARCH.md; epsilon=1)"
    - "Tailwind `group` outer + `group-hover:` (set up for Plan 08 .scrollbar-thin)"
    - "JSDOM scroll geometry simulation via Object.defineProperty on the region element (canonical RTL pattern for scroll tests)"

key_files:
  created:
    - components/widgets/__tests__/WidgetCard.test.tsx (161 lines)
    - .planning/phases/04-scrollable-feed-cards-scrum-49/04-03-SUMMARY.md
  modified:
    - components/widgets/WidgetCard.tsx (47 → 82 lines)
    - vitest.config.ts (+2 lines: import + plugins entry)
    - package.json (+1 devDependency)
    - package-lock.json (regenerated)

decisions:
  - "Used raw `getAttribute()` equality assertions instead of `toHaveAttribute()` to avoid a fourth devDependency (`@testing-library/jest-dom`). Plain Chai matchers are sufficient for the six tests in this plan and follow the project's minimal-deps convention."
  - "Inlined the scroll-at-bottom hook inside WidgetCard.tsx rather than creating `lib/hooks/use-scroll-at-bottom.ts` — per 04-RESEARCH.md Open Question 1 (Claude's Discretion), the DOM hook is a one-off and starting a `lib/hooks/dom/` subdirectory would be premature factoring."
  - "Kept the bottom-fade overlay inline as JSX (no `<ScrollableFade />` subcomponent) — per 04-RESEARCH.md Open Question 3, the overlay is 4 lines and lifting it would obscure the scroll-aware visibility logic."

metrics:
  duration_minutes: ~10
  tasks_completed: 2
  files_touched: 4
  tests_added: 6
  tests_passing_before: 102
  tests_passing_after: 108
  completed: 2026-05-15T04:14:50Z
---

# Phase 04 Plan 03: Scrollable WidgetCard Contract + RED/GREEN Tests Summary

Extended `components/widgets/WidgetCard.tsx` with the locked CONTEXT.md
D3/D4/D5/D8 scrollable contract — optional `scrollable` + `maxBodyHeight`
props, a scroll-aware bottom-fade overlay, ARIA + focus-visible affordances,
and a `group` outer class for Plan 08's `.scrollbar-thin` hover toggle —
while preserving a byte-identical non-scrollable branch for the three
non-feed consumers (TrendingWidget, SentimentWidget, HeroStoryCard).

## Final Line Counts

| File | Before | After |
|------|--------|-------|
| `components/widgets/WidgetCard.tsx` | 47 | 82 |
| `components/widgets/__tests__/WidgetCard.test.tsx` | (new) | 161 |

## Tests (6 total — all GREEN)

| # | Decision | What it asserts |
|---|----------|-----------------|
| 1 | D3 + D8 | When `scrollable={true}`, the rendered region has `role="region"`, `tabindex="0"`, and `aria-label="YouTube feed, scrollable"` (composed from the `title` prop). |
| 2 | D3 (backward compat) | When `scrollable` is omitted, the component renders **no** element with `role="region"` AND the original `<div className="px-3.5 py-2.5">{children}</div>` body wrapper is preserved with the child content. |
| 3 | D4 | After overflow geometry is simulated (`scrollTop=0, clientHeight=320, scrollHeight=1000`) and a scroll event fires, the `aria-hidden="true"` overlay is present inside the region and carries the `bg-gradient-to-t` + `pointer-events-none` classes. |
| 4 | D5 | After overflow → fade-visible, then geometry mutated to "at bottom" (`scrollTop=9999, clientHeight=320, scrollHeight=320`) and a scroll event fires, the `aria-hidden="true"` overlay is removed from the DOM. |
| 5 | D8 | The scroll region's `className` contains `outline-none`, `focus-visible:ring-1`, `focus-visible:ring-accent`, and `focus-visible:ring-inset` — satisfying WCAG 2.4.7 "Focus Visible" Level AA. |
| 6 | D5 (initial no-overflow) | When children fit inside the container (jsdom default geometry: `scrollHeight === clientHeight`), the synchronous initial `check()` call inside `useEffect` sets `atBottom=true` and the fade overlay is NOT rendered. |

## Non-Scrollable Branch — Byte-Identical Verification

```
$ grep -n '<div className="px-3.5 py-2.5">{children}</div>' \
        components/widgets/WidgetCard.tsx
78:        <div className="px-3.5 py-2.5">{children}</div>
```

Test 2 (`Test 2 (D3 backward compat)`) also asserts that:
- `screen.queryByRole("region")` returns `null` when `scrollable` is omitted.
- The original body wrapper still wraps the children.

Both checks pass — TrendingWidget, SentimentWidget, and HeroStoryCard
continue to render byte-identical DOM.

## Test-Suite Delta

| State | Files | Tests |
|-------|-------|-------|
| Before this plan | 12 | 102 |
| After this plan | 13 | 108 |
| Delta | **+1 file** | **+6 tests** |

Full-suite verification: `npx vitest run` → `Test Files 13 passed (13)` /
`Tests 108 passed (108)`.

## Commits

| Hash | Type | Message |
|------|------|---------|
| `967b526` | chore | add @vitejs/plugin-react for Vitest JSX transform |
| `86014e0` | test | add failing tests for WidgetCard scrollable contract (RED) |
| `0ebddb0` | feat | extend WidgetCard with scrollable + maxBodyHeight contract (GREEN) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Missing `@vitejs/plugin-react` devDependency**

- **Found during:** Task 1 (initial RED run of `WidgetCard.test.tsx`).
- **Issue:** Wave 0 (Plan 04-01) installed `@testing-library/react@^16`,
  `@testing-library/dom@^10`, and `jsdom@^29` and extended the Vitest
  `include` glob, but did NOT install `@vitejs/plugin-react` and did NOT
  register it in `vitest.config.ts`. Without the React plugin, Vite/Vitest
  cannot transform JSX in `.tsx` test files — every Wave 1 component test
  fails at parse-time with `"Failed to parse source for import analysis
  because the content contains invalid JS syntax. If you use tsconfig.json,
  make sure to not set jsx to preserve"` before any assertion runs. The
  project's `tsconfig.json` (correctly) uses `jsx: "preserve"` for Next.js,
  so the Vite plugin is the canonical fix.
- **Fix:** `npm install --save-dev @vitejs/plugin-react@^4` (resolved to
  `4.7.0`), then update `vitest.config.ts` to `import react from
  "@vitejs/plugin-react"` and register `plugins: [react()]` alongside the
  existing `test:` block. This is verified against the canonical Vitest 4
  docs (Context7 / vitest-dev/vitest) — the standard React-on-Vitest
  pattern.
- **Files modified:** `package.json`, `package-lock.json`, `vitest.config.ts`.
- **Commit:** `967b526`.
- **Impact on downstream wave-1 plans:** Plans 04-04, 04-05, 04-06, 04-07
  also produce `.tsx` test files; this fix unblocks all four. Each parallel
  worktree agent will pick up the change at merge time, but the merge will
  be a no-op for them since the change is idempotent.

**2. [Rule 3 — Blocking issue] `expect(...).toHaveAttribute()` matcher not available**

- **Found during:** Task 2 (initial GREEN run after WidgetCard.tsx update).
- **Issue:** Test 1 failed with `Invalid Chai property: toHaveAttribute`.
  The `toHaveAttribute` matcher is provided by `@testing-library/jest-dom`,
  which is NOT installed in this project — Wave 0 deliberately scoped to
  three packages.
- **Fix:** Replaced `expect(region).toHaveAttribute("...", "...")` with
  `expect(region.getAttribute("..."))`-style raw checks. Plain Chai
  matchers are sufficient for the six tests; this avoids adding a fourth
  devDependency to support a single matcher.
- **Files modified:** `components/widgets/__tests__/WidgetCard.test.tsx`
  (one block of three assertions in Test 1).
- **Commit:** Folded into `0ebddb0` (the GREEN commit) since it was a
  one-line iteration during GREEN verification.

## Authentication Gates

None. Pure frontend component work — no external services, no auth surfaces.

## Acceptance Criteria — Per-Task Confirmation

### Task 1 (RED)

- [x] File `components/widgets/__tests__/WidgetCard.test.tsx` exists.
- [x] First line is exactly `// @vitest-environment jsdom`.
- [x] Tests reference `role="region"` (Test 1, Test 2's negative assertion).
- [x] Tests reference `aria-label="YouTube feed, scrollable"`.
- [x] Two `aria-hidden` references (Tests 3, 4, 6).
- [x] `fireEvent.scroll` reference (Tests 3, 4).
- [x] `focus-visible:ring` reference (Test 5).
- [x] First RED run (before Task 2's GREEN commit) failed 4/6 — non-zero
      exit code achieved.

### Task 2 (GREEN)

- [x] `npx vitest run components/widgets/__tests__/WidgetCard.test.tsx` exits 0.
- [x] `scrollable?: boolean` declared in props (1 match).
- [x] `maxBodyHeight?: string` declared in props (1 match).
- [x] `role="region"` in JSX (1 match).
- [x] `aria-label={`${title} feed, scrollable`}` in JSX (verified via Vitest
      Test 1, which asserts the exact string `"YouTube feed, scrollable"`).
- [x] `aria-hidden="true"` on the fade overlay (1 match).
- [x] `addEventListener("scroll"` in useEffect (1 match).
- [x] `passive: true` in listener options (1 match).
- [x] `focus-visible:ring-1` on the region (1 match).
- [x] `className="group ` on the outer div (1 match).
- [x] Non-scrollable branch is byte-identical: `<div className="px-3.5 py-2.5">{children}</div>` (1 match).
- [x] Full Vitest suite green: 13 files / 108 tests (+1 file, +6 tests vs baseline).
- [x] `npx tsc --noEmit` exits 0.
- [ ] `npm run lint` exit code 1 — **pre-existing worktree environment**
      issue (a stray `.eslintrc.json` outside the worktree at `../../../`
      conflicts with the project root config). Verified by stashing my
      changes and re-running `npm run lint`: the same error reproduces on
      the unmodified base. **Out of scope per the Scope Boundary rule**
      (issue not caused by this plan's changes). Documented here for
      visibility; logged as a deferred environmental issue, not a code
      regression.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or trust-boundary
schema changes. The `threat_model` block of the plan correctly identified
zero new boundaries — the scroll region is rendered DOM with `role="region"`
+ `aria-label`, which is the locked D8 mitigation already covered by the
plan's `T-04-a11y-regression` entry and validated by Test 1.

No threat flags raised.

## Known Stubs

None. The scrollable branch is fully implemented and consumer-ready — Plans
04-04 through 04-07 will wire each feed widget to pass `scrollable
maxBodyHeight="max-h-[320px]"` to this contract.

## Self-Check: PASSED

- [x] `components/widgets/WidgetCard.tsx` exists (82 lines).
- [x] `components/widgets/__tests__/WidgetCard.test.tsx` exists (161 lines).
- [x] `vitest.config.ts` has `plugins: [react()]`.
- [x] `package.json` `devDependencies["@vitejs/plugin-react"]` is present.
- [x] Commit `967b526` (chore) is reachable from `HEAD`.
- [x] Commit `86014e0` (test/RED) is reachable from `HEAD`.
- [x] Commit `0ebddb0` (feat/GREEN) is reachable from `HEAD`.
- [x] `npx vitest run` exits 0 with 108 tests.
- [x] `npx tsc --noEmit` exits 0.
