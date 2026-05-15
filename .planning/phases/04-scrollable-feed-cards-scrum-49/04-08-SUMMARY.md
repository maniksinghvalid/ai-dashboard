---
phase: 04-scrollable-feed-cards-scrum-49
plan: 08
subsystem: ui

tags: [css, tailwind, scrollbar, globals, layer-discipline, phase-end-gate]

# Dependency graph
requires:
  - phase: 04-scrollable-feed-cards-scrum-49
    provides: "WidgetCard.tsx scroll wrapper consumes .scrollbar-thin + .group:hover descendant selector (Plan 03)"
  - phase: 04-scrollable-feed-cards-scrum-49
    provides: "Four feed widgets wire the scroll wrapper (Plans 04–07) — together with this plan they complete the visible-scrollbar contract"
provides:
  - ".scrollbar-thin utility class in app/globals.css (webkit hover-only + Firefox always-on)"
  - "Phase-end layer-discipline gate evidence: zero changes in lib/api/{youtube,reddit,twitter,news,trending,hero}.ts vs phase-start 0d0d928"
  - "Final phase-end suite gate (npm test + npx tsc --noEmit + npm run lint + npm run build) all green"
affects: [post-phase manual QA gates 04-G-02 column balance and 04-G-03 cross-browser, future phases consuming .scrollbar-thin utility]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hover-scoped scrollbar visibility via `.group:hover .scrollbar-thin::-webkit-scrollbar-thumb` descendant selector (pairs with the `group` class on WidgetCard outer div)"
    - "Firefox graceful-degradation pattern: always-thin scrollbar via `scrollbar-width: thin` + `scrollbar-color`"

key-files:
  created: []
  modified:
    - "app/globals.css — extended trailing @layer utilities block with `.scrollbar-thin` rules (19 lines added)"

key-decisions:
  - "Authored .scrollbar-thin rules verbatim inside the EXISTING `@layer utilities` block (after `.text-balance`), not as a second block. Both forms are equivalent at build time per the plan's note, but a single layer block is cleaner."
  - "Phase-start SHA resolved to 0d0d928 (the SCRUM-48 merge commit on develop) — the commit immediately before plan-04 work began (`3db0476`, the first phase commit installing jsdom/@testing-library)."
  - "Task 2 produced no code changes — verification-only — so no commit was created for it. Gate evidence is recorded in this SUMMARY."

patterns-established:
  - "Layer-discipline gate at phase end: `git diff --stat <phase-start>..HEAD -- <pipeline-files>` MUST be empty. This formalizes the CONTEXT.md `<domain>` 'Out of in-scope artifacts' invariant as an executable check."

requirements-completed: [D1, D6, SC-1, SC-4, SC-5, SC-7]

# Metrics
duration: 4min
completed: 2026-05-15
---

# Phase 04 Plan 08: Scrollbar Utility + Phase-End Layer-Discipline Gate Summary

**`.scrollbar-thin` utility added to `app/globals.css` (4px webkit hover-only + Firefox always-thin), and phase-end layer-discipline gate proves zero leaks into `lib/api/{youtube,reddit,twitter,news,trending,hero}.ts` vs phase-start `0d0d928`.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-15T04:26:33Z
- **Completed:** 2026-05-15T04:30:43Z
- **Tasks:** 2 (1 code task + 1 verification-only gate task)
- **Files modified:** 1 (`app/globals.css`)

## Accomplishments

- Added five `.scrollbar-thin` CSS rules + one `.group:hover` descendant rule to `app/globals.css`, making the WidgetCard scroll wrapper (Plan 03) render with a 4px hover-revealed webkit scrollbar and a Firefox-native thin scrollbar.
- Preserved the existing body-level `::-webkit-scrollbar` rules at lines 47–56 unchanged.
- Executed the phase-end **layer-discipline gate** (CONTEXT.md "Out of in-scope artifacts" + threat T-04-layer-leak): `git diff --stat 0d0d928..HEAD -- lib/api/youtube.ts lib/api/reddit.ts lib/api/twitter.ts lib/api/news.ts lib/api/trending.ts lib/api/hero.ts` produced **zero output lines** — none of the six pipeline files have been touched across the entire phase.
- Ran the final phase-end full suite gate: `npm test` (17 files, 128 tests passing), `npx tsc --noEmit` (exit 0), `npm run lint` (✔ No ESLint warnings or errors), `npm run build` (exit 0). All four green.

## Task Commits

Each task was committed atomically (Task 2 produced no code changes, so no commit was created for it per the plan's "verification-only step" note):

1. **Task 1: Add `.scrollbar-thin` utility to `app/globals.css`** — `f340595` (feat)
2. **Task 2: Run phase-end layer-discipline gate** — verification-only, no commit (no code changes)

## Files Created/Modified

- `app/globals.css` — Appended 19 lines inside the existing trailing `@layer utilities { … }` block (after `.text-balance`): five `.scrollbar-thin` rules (webkit base + three pseudo-elements + Firefox shorthand) plus one `.group:hover .scrollbar-thin::-webkit-scrollbar-thumb` descendant rule. Body-level scrollbar rules at lines 47–56 are unchanged. CSS variable `--surface2` (line 9) is unchanged.

## Exact CSS Block Added

```css
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: var(--surface2) transparent;
  }
  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: var(--surface2);
    border-radius: 4px;
    opacity: 0;
    transition: opacity 150ms ease;
  }
  .group:hover .scrollbar-thin::-webkit-scrollbar-thumb {
    opacity: 1;
  }
}
```

(Block as authored: the `.text-balance` rule was kept in place; the seven new lines were appended after it inside the same `@layer utilities` block per the plan's preferred shape.)

## Phase-End Layer-Discipline Gate (Task 2)

**Base SHA used:** `0d0d928` — the SCRUM-48 merge commit on `develop`, the last commit before any phase-04 work began. Confirmed by inspecting `git log --oneline -50`: the first phase-04 commit is `3db0476 chore(04-01): install jsdom/@testing-library devDependencies for component tests`, and its parent on `develop` is `0d0d928`.

**Command run:**

```bash
git diff --stat 0d0d928..HEAD \
  -- lib/api/youtube.ts lib/api/reddit.ts lib/api/twitter.ts \
     lib/api/news.ts lib/api/trending.ts lib/api/hero.ts
```

**Output:** (empty — zero lines)

**Conclusion:** All six fetcher/pipeline files are byte-identical to their state at the start of phase 04. The D1 layer-discipline invariant (the 15-item cap is enforced at the widget render layer ONLY; trending/velocity/hero promotion continue to consume the full pre-slice fetcher arrays) is preserved across the entire phase. **Gate PASS.**

This forecloses the T-04-layer-leak threat in the plan's STRIDE register.

## Final Suite Gate

| Gate | Command | Result |
|---|---|---|
| Unit + component tests | `npm test` | **PASS** — 17 test files, 128 tests, 2.27s |
| TypeScript | `npx tsc --noEmit` | **PASS** — exit 0 |
| ESLint | `npm run lint` | **PASS** — ✔ No ESLint warnings or errors |
| Production build | `npm run build` | **PASS** — exit 0, all 5 routes compiled |

## Acceptance Criteria (Task 1)

- ✅ `grep -c 'scrollbar-thin' app/globals.css` returns 5 (≥ 5 required)
- ✅ `grep -c 'scrollbar-width: thin' app/globals.css` returns 1
- ✅ `grep -c 'scrollbar-color: var(--surface2) transparent' app/globals.css` returns 1
- ✅ `grep -F '.group:hover .scrollbar-thin::-webkit-scrollbar-thumb' app/globals.css` matches one line
- ✅ `grep -c '::-webkit-scrollbar' app/globals.css` returns 7 (≥ 4 required — 3 body-level pre-existing + 3 new `.scrollbar-thin` pseudo-elements + 1 hover descendant)
- ✅ `grep -c 'opacity: 1;' app/globals.css` returns 1 (≥ 1 required)
- ✅ `npm run build` exits 0

## Acceptance Criteria (Task 2)

- ✅ Layer-discipline diff produces zero lines (no files listed as changed)
- ✅ `npm test` exits 0 (128/128 tests passing)
- ✅ `npx tsc --noEmit` exits 0
- ✅ `npm run lint` exits 0
- ✅ `npm run build` exits 0

## Decisions Made

- Authored the new rules **inside the existing `@layer utilities` block** (immediately after `.text-balance`) rather than appending a second `@layer utilities` block. The plan permits both forms ("both forms are equivalent at build time"); the single-block form is cleaner and is what `npm run build` validated.
- **No commit for Task 2:** the plan explicitly says "No code changes happen in this task — it is a verification-only step that closes the phase." Creating an empty commit would have introduced churn with no diff payload, so the gate evidence is captured here in SUMMARY.md instead.
- **Phase-start SHA = `0d0d928`** (not a deeper commit). This is the last commit before any phase-04 artifact landed on `develop` — see `git log --oneline -50` analysis above.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — the WidgetCard scroll wrapper (Plan 03) already had the `group` class on the outer div and `scrollbar-thin` on the scroll wrapper, so the new CSS rules wire up immediately with no widget-side changes. The `--surface2` CSS variable (line 9 of `globals.css`) was already defined and is used by both the new utility and the existing body-level rules.

## Open Items for Post-Phase Manual QA Gates

These two gates from `04-VALIDATION.md` are **manual-only** by design and remain pending after this plan completes — they are tracked outside the executor's automated scope:

| Gate | Requirement | What to verify |
|---|---|---|
| **04-G-02 (D7 column balance)** | Visual column-balance at ≥1280px viewport | Hard-reload `npm run dev` at 1280 / 1440 / 1920 px. Side columns (2 widgets each at `max-h-[320px]`) should not diverge from center column (Hero + Trending + Sentiment) by more than ~30–50 px. Sanctioned fallback if imbalance > 30 px at 1920: switch all four widgets to `maxBodyHeight="max-h-[calc(100vh-380px)]"` uniformly (per UI-SPEC). |
| **04-G-03 (cross-browser scrollbar)** | Webkit hover-toggle + Firefox thin-always-on per D6 | Chrome / Safari: hover a feed card → thin 4 px scrollbar fades in at `opacity: 1`; mouse leave → fades to `opacity: 0` over 150 ms. Firefox: thin native scrollbar visible at all times when content overflows; thumb color matches `--surface2`. Both: bottom-fade overlay (D4/D5) disappears when scrolled to bottom (`scrollTop + clientHeight >= scrollHeight − 1`). |

## Next Phase Readiness

- **Phase 4 Goal achievable:** with this plan complete, all four feed widgets (YouTube, Reddit, X, News) render up to `MAX_FEED_ITEMS = 15` items in scrollable card bodies with a hover-aware thin scrollbar (webkit) and a static thin scrollbar (Firefox), backed by a bottom-fade overlay that disappears on scroll-to-bottom.
- **Layer-discipline invariant intact** — Phase 5 (or any later phase) can rely on `lib/api/{youtube,reddit,twitter,news,trending,hero}.ts` being byte-identical to their pre-phase-04 state.
- **Open blocker:** the two manual QA gates above must run before SCRUM-49 can be marked Done. They are not implementation work; they are visual verification at three viewport widths and three browsers.

## Self-Check

**1. File existence:**

```
$ [ -f app/globals.css ] && echo FOUND
FOUND
```

**2. Commit existence:**

```
$ git log --oneline --all | grep -q f340595 && echo FOUND
FOUND
```

**3. CSS payload sanity:**

```
$ grep -c 'scrollbar-thin' app/globals.css
5
$ grep -F '.group:hover .scrollbar-thin::-webkit-scrollbar-thumb' app/globals.css
  .group:hover .scrollbar-thin::-webkit-scrollbar-thumb {
```

**4. Layer-discipline gate (re-run):**

```
$ git diff --stat 0d0d928..HEAD -- lib/api/youtube.ts lib/api/reddit.ts lib/api/twitter.ts lib/api/news.ts lib/api/trending.ts lib/api/hero.ts
(empty)
```

## Self-Check: PASSED

---
*Phase: 04-scrollable-feed-cards-scrum-49*
*Completed: 2026-05-15*
