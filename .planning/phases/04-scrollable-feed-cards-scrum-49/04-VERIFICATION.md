---
phase: 04-scrollable-feed-cards-scrum-49
verified: 2026-05-15T04:35:25Z
status: human_needed
score: 8/9 must-haves verified (D7 column-balance + cross-browser require human QA)
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "D7 — Three-column grid balance at >=1280px viewport"
    expected: "Left, center, right columns do not visibly diverge in height by more than the existing column-balance tolerance of the unmodified dashboard. Side columns may end before the center; that is acceptable. Dashboard does not look broken at 1280 / 1440 / 1920 px."
    why_human: "No visual-regression tooling in this repo. Column balance is a perceptual gate; the codebase ships max-h-[320px] uniformly, but whether that is the right number against the live trending + hero + sentiment column stack at viewport heights >=720px is a visual judgement that cannot be asserted in jsdom."
  - test: "SC-7 — Cross-browser scrollbar + fade behavior"
    expected: "WebKit (Chrome / Safari): hover over a feed card -> thin 4px scrollbar fades in via the .group:hover .scrollbar-thin::-webkit-scrollbar-thumb opacity:1 rule; move mouse away -> fades out. Firefox: thin native scrollbar visible at all times while content overflows. Both browsers: scrolling to the bottom hides the gradient fade overlay per D5."
    why_human: "WebKit's ::-webkit-scrollbar pseudo-elements are not rendered in jsdom, and Firefox's scrollbar-width: thin is browser-engine behavior. Neither is automatable in this stack."
  - test: "D8 — Keyboard scroll affordance"
    expected: "Tab into a feed widget: focus lands on the scroll container (visible focus-visible:ring-accent ring) and is reachable. With container focused, arrow-down scrolls items. Container does not steal focus from inner <a> rows when those rows are tab-targeted afterward."
    why_human: "Render-time tests assert the focus-visible classes are present (PASSED), but the actual focus-ring rendering + arrow-key scroll interaction is a runtime visual-and-input behavior that requires a real browser."
---

# Phase 04: Scrollable Feed Cards (SCRUM-49) Verification Report

**Phase Goal (from ROADMAP.md):** Render up to 15 items in each of the four feed widgets (YouTube, Reddit, X/Twitter, News) inside a scrollable card body with a bottom-fade cue when more content is below the fold. The cap is enforced at the widget render layer only; fetchers and the trending/velocity pipeline are unchanged. The 3-column dashboard grid must remain visually balanced at >=1280px viewport.

**Verified:** 2026-05-15T04:35:25Z
**Status:** human_needed (all programmatically-verifiable items PASS; D7 column-balance and SC-7 cross-browser remain for human visual QA per VALIDATION.md `Manual-Only Verifications`)
**Re-verification:** No - initial verification.

---

## Goal Achievement

### Observable Truths (mapped to LOCKED decisions D1-D9 + ROADMAP SC-1..SC-7)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | D1 / SC-1: 15-item cap is enforced at widget render layer; fetchers untouched | VERIFIED | `git diff --stat 002d793..HEAD -- lib/api/youtube.ts lib/api/reddit.ts lib/api/twitter.ts lib/api/news.ts lib/api/trending.ts lib/api/hero.ts` is empty (zero output). `grep -rn "MAX_FEED_ITEMS" lib/api/` returns no results. All four widget files import `MAX_FEED_ITEMS` and call `.slice(0, MAX_FEED_ITEMS)` (see Artifacts table). |
| 2 | D2 / SC-1: `MAX_FEED_ITEMS = 15` is exported from `lib/constants.ts` (single source of truth) | VERIFIED | `lib/constants.ts:95` `export const MAX_FEED_ITEMS = 15;` plus inline comment recording the D1 rationale. `lib/constants.test.ts:90-100` asserts `MAX_FEED_ITEMS === 15` and `Number.isInteger`. No hardcoded `15` in any widget file (`grep "slice(0, 15)" components/widgets/*.tsx` is empty). |
| 3 | D3 / SC-2: `WidgetCard` exposes `scrollable` + `maxBodyHeight` props and wraps the body in a scrollable region with the four required ARIA attributes when `scrollable=true` | VERIFIED | `components/widgets/WidgetCard.tsx:9-10` declares the props; lines 18-19 type them as `scrollable?: boolean` and `maxBodyHeight?: string`. Lines 61-76 conditionally render a `<div role="region" tabIndex={0} aria-label={\`${title} feed, scrollable\`}>` with `relative ${maxBodyHeight ?? "max-h-[320px]"} overflow-y-auto scrollbar-thin px-3.5 py-2.5`. Non-scrollable branch (line 78) preserves the original `<div className="px-3.5 py-2.5">` byte-for-byte (verified by `WidgetCard.test.tsx` Test 2). |
| 4 | D4 / SC-2: Bottom-fade is a sibling absolutely-positioned overlay (not `::after`), aria-hidden, with `pointer-events-none` and gradient classes | VERIFIED | `WidgetCard.tsx:70-75` renders `<div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 right-0 h-9 bg-gradient-to-t from-[var(--surface)] to-transparent" />` — matches CONTEXT.md D4 verbatim. The overlay is gated on `!atBottom`, so it disappears when at-bottom (D5). |
| 5 | D5 / SC-3: Fade is scroll-aware — hidden at bottom, visible when overflowing | VERIFIED | `WidgetCard.tsx:22-34` `useEffect` adds a `passive` scroll listener that recomputes `atBottom = scrollTop + clientHeight >= scrollHeight - 1`; the listener is gated on `scrollable` and cleaned up on unmount. `WidgetCard.test.tsx` Tests 3, 4, 6 simulate overflow / at-bottom / no-overflow via `Object.defineProperty` on scroll geometry + `fireEvent.scroll` and all pass. |
| 6 | D6 / SC-4: `.scrollbar-thin` utility lives in `app/globals.css` with WebKit + Firefox rules, hover-toggled visibility via `.group:hover` | VERIFIED | `app/globals.css:58-81` defines `.scrollbar-thin` inside `@layer utilities` with `scrollbar-width: thin; scrollbar-color: var(--surface2) transparent;` (Firefox), `::-webkit-scrollbar { width: 4px }`, `::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 4px; opacity: 0; transition: opacity 150ms ease; }`, and `.group:hover .scrollbar-thin::-webkit-scrollbar-thumb { opacity: 1; }`. CSS-var name is `--surface2` (correct — matches `:root` at line 9), not `--surface-2`. |
| 7 | D7 / SC-5: Three-column grid stays balanced at >=1280px | UNCERTAIN | All four widgets ship `maxBodyHeight="max-h-[320px]"` uniformly (per D7 implementation discretion). `lib/api/trending.ts` and `lib/api/hero.ts` are untouched (covered by Truth 1) so they still receive pre-slice arrays — no regression in trending/hero quality. Visual column balance is **not programmatically verifiable**; routed to human verification (see VALIDATION.md `Manual-Only Verifications`). |
| 8 | D8 / SC-2: Scroll region is keyboard-focusable with focus-visible accent ring; fade overlay is aria-hidden | VERIFIED (programmatic) | `WidgetCard.tsx:64-67` declares `tabIndex={0}`, `role="region"`, `aria-label`, and the className includes `outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-inset`. `WidgetCard.test.tsx` Test 5 asserts all four classes are present. The fade overlay (line 72) is `aria-hidden="true"` + `pointer-events-none`. Live focus-ring rendering and arrow-key scroll are routed to human verification. |
| 9 | D9 / SC-2 carry-over: Badge contract preserved — `${count} new` reflects live array length 1-15, no diff logic | VERIFIED | YouTubeWidget renders `${count} new` where `count = videos?.length ?? 0` (asserted by YouTubeWidget Test 2 with 7 videos -> "7 new" and Test 3 with 15 videos -> "15 new"). NewsWidget mirrors this pattern (NewsWidget Tests 2-3 cover 8 and 15). RedditWidget keeps the existing static `"r/ML · r/AI"` badge (RedditWidget Test 4). XFeedWidget keeps `"Live feed"`. None of the widgets add diff logic. |

**Score:** 8/9 truths verified programmatically. Truth 7 (D7 column-balance) is locked behind a human visual gate per CONTEXT.md D7 (which itself declared specific heights deferred to implementation review) and per VALIDATION.md's `Manual-Only Verifications` table.

### Required Artifacts (Levels 1-3: exists, substantive, wired)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/constants.ts` | Exports `MAX_FEED_ITEMS = 15` next to `CACHE_KEYS` / `CACHE_MAX_AGE`, no hardcoded `15` in widgets | VERIFIED | Line 95 export with explanatory comment (lines 91-94). Imported by 4 widget files + 1 test. |
| `components/widgets/WidgetCard.tsx` | Adds `scrollable` + `maxBodyHeight` props, scroll-aware fade overlay, a11y attrs, focus-visible ring, `group` class on outer div | VERIFIED | All locked behaviors present (see Truth rows 3-5, 8). 82 lines. Imported by all 4 feed widgets + Trending + Sentiment + (transitively) DashboardShell. |
| `components/widgets/YouTubeWidget.tsx` | `slice(0, MAX_FEED_ITEMS)` (was `slice(0, 4)`); `scrollable + maxBodyHeight="max-h-[320px]"` passed on populated branch; empty/error/loading paths do NOT pass scrollable | VERIFIED | Line 87 slice; lines 72-73 conditional scrollable/maxBodyHeight gated on `isPopulated`. YouTubeWidget Tests 1-5 all pass (cap, badge text at 7 and 15, scrollable on populated, no region on empty). Wired in `DashboardShell.tsx:29`. |
| `components/widgets/RedditWidget.tsx` | `slice(0, MAX_FEED_ITEMS)` (was `slice(0, 3)`); scrollable wiring on populated branch only | VERIFIED | Line 72 slice; lines 49-58 conditional props gated on `Array.isArray && length > 0 && !isLoading && !error`. RedditWidget Tests 1-4 all pass. Wired in `DashboardShell.tsx:38`. |
| `components/widgets/XFeedWidget.tsx` | `slice(0, MAX_FEED_ITEMS)` (was `slice(0, 4)`); scrollable wiring on populated branch only | VERIFIED | Line 104 slice; lines 89-90 conditional props. XFeedWidget Tests 1-4 all pass (30 -> 15, aria-label, empty branch, 12-row gradient rotation). Wired in `DashboardShell.tsx:82`. |
| `components/widgets/NewsWidget.tsx` | `slice(0, MAX_FEED_ITEMS)` (was `slice(0, 5)`); scrollable wiring + dynamic count badge | VERIFIED | Line 90 slice; lines 75-76 conditional props; line 73 `badge={count > 0 ? \`${count} new\` : undefined}`. NewsWidget Tests 1-5 all pass. Wired in `DashboardShell.tsx:91`. |
| `app/globals.css` | `.scrollbar-thin` utility (WebKit + Firefox, hover-scoped via `.group:hover`) inside `@layer utilities` | VERIFIED | Lines 58-81 (see Truth 6). |
| `vitest.config.ts` | Include glob extended to `**/*.test.{ts,tsx}`; `@vitejs/plugin-react` registered for JSX transform | VERIFIED | Line 9 `include: ["**/*.test.{ts,tsx}"]`; line 6 `plugins: [react()]`. |
| `package.json` | Adds `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@vitejs/plugin-react` to devDependencies | VERIFIED | Lines 27-32 — all four present at expected major versions. |
| `lib/constants.test.ts` | Asserts `MAX_FEED_ITEMS === 15` | VERIFIED | Lines 90-100 (`describe("MAX_FEED_ITEMS")`). |
| `components/widgets/__tests__/WidgetCard.test.tsx` | Covers D3 / D4 / D5 / D8 | VERIFIED | 6 tests; all pass. |
| `components/widgets/__tests__/YouTubeWidget.test.tsx` | Covers D1 cap + D9 badge + scrollable wiring | VERIFIED | 5 tests; all pass. |
| `components/widgets/__tests__/RedditWidget.test.tsx` | Covers D1 cap + scrollable wiring + badge preservation | VERIFIED | 4 tests; all pass. |
| `components/widgets/__tests__/XFeedWidget.test.tsx` | Covers D1 cap + scrollable wiring | VERIFIED | 4 tests; all pass. |
| `components/widgets/__tests__/NewsWidget.test.tsx` | Covers D1 cap + D9 badge + scrollable wiring | VERIFIED | 5 tests; all pass. |

### Key Link Verification (Wiring)

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| 4 feed widgets | `lib/constants.MAX_FEED_ITEMS` | ES import + `.slice(0, MAX_FEED_ITEMS)` | WIRED | `grep "MAX_FEED_ITEMS"` shows import statement + slice call in each of YouTubeWidget, RedditWidget, XFeedWidget, NewsWidget. |
| 4 feed widgets | `WidgetCard` (scrollable + maxBodyHeight) | Conditional prop passing on populated branch | WIRED | Each widget gates `scrollable` and `maxBodyHeight` on `Array.isArray(data) && data.length > 0 && !isLoading && !error` -> only the populated branch wires the scroll region. Verified by per-widget Test "empty branch" cases (no region rendered when data is `[]`). |
| `WidgetCard.scrollable` branch | `.scrollbar-thin` in globals.css | className substring `scrollbar-thin` in the scroll wrapper | WIRED | `WidgetCard.tsx:67` includes `scrollbar-thin`; class is defined in `app/globals.css:62`. |
| `WidgetCard` outer div | `.group:hover .scrollbar-thin::-webkit-scrollbar-thumb` rule | `group` class on `WidgetCard.tsx:37` outer div | WIRED | Outer div carries `className="group ..."` (line 37); the CSS rule in globals.css uses `.group:hover .scrollbar-thin::-webkit-scrollbar-thumb { opacity: 1 }` (line 78-80). |
| `DashboardShell` | 4 feed widgets | ES import + JSX element | WIRED | `DashboardShell.tsx:8-13` imports all four; lines 29, 38, 82, 91 mount them. Untouched by this phase (D7 invariant). |
| `lib/api/trending.ts` + `lib/api/hero.ts` | Pre-slice fetcher arrays | Their existing call sites consume full arrays before the widget cap | WIRED (unchanged) | `git log 002d793..HEAD -- lib/api/trending.ts lib/api/hero.ts` is empty; their consumption sites were not modified. SC-5 invariant preserved. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `YouTubeWidget` | `videos` (prop) | `useDashboard()` -> `useApiData<Video[]>("youtube")` -> `/api/youtube/route.ts` -> Redis `yt:latest` -> populated by cron from `fetchYouTubeVideos` | YES — fetcher untouched; SWR pipeline unchanged | FLOWING (no regression vs pre-phase). |
| `RedditWidget` | `posts` | `useDashboard()` -> `useApiData<RedditPost[]>("reddit")` -> Redis `reddit:hot` -> `fetchRedditPosts` (RSS) | YES — fetcher untouched | FLOWING. |
| `XFeedWidget` | `tweets` | `useDashboard()` -> `useApiData<Tweet[]>("x")` -> Redis `x:feed` -> `fetchTweets` | YES — fetcher untouched | FLOWING. |
| `NewsWidget` | `items` | `useDashboard()` -> `useApiData<NewsItem[]>("news")` -> Redis `news:feed` -> `fetchNews` | YES — fetcher untouched | FLOWING. |
| `WidgetCard` (scrollable branch) | `atBottom` (local state) | `useEffect` scroll listener computing `scrollTop + clientHeight >= scrollHeight - 1` | YES — initial check on mount + listener on every scroll | FLOWING (D5). |

The fetcher / SWR / Redis pipeline is identical to the pre-phase tree (Truth 1). The only new data-flow surface this phase introduces is the local `atBottom` state inside `WidgetCard`, which is wired correctly.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit + component test suite green | `npm test` | `Test Files  17 passed (17) / Tests  128 passed (128) / Duration  2.92s` | PASS |
| TypeScript strict-clean | `npx tsc --noEmit` | exit 0, no output | PASS |
| ESLint clean (Prettier-compatible) | `npm run lint` | `No ESLint warnings or errors` | PASS |
| Phase-end layer-discipline gate (D1 / SC-1) | `git diff --stat 002d793..HEAD -- lib/api/youtube.ts lib/api/reddit.ts lib/api/twitter.ts lib/api/news.ts lib/api/trending.ts lib/api/hero.ts` | empty | PASS |
| No hardcoded `15` in widget files | `grep "slice(0, 15)" components/widgets/*.tsx` | empty | PASS |
| No `MAX_FEED_ITEMS` import in `lib/api/` (forbidden by D2 comment) | `grep -rn "MAX_FEED_ITEMS" lib/api/` | empty | PASS |
| All 4 widgets import `MAX_FEED_ITEMS` from `lib/constants` | `grep -l "MAX_FEED_ITEMS" components/widgets/*.tsx` | 4 files (YouTubeWidget, RedditWidget, XFeedWidget, NewsWidget) | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` artifacts exist in the repo, and no PLAN / SUMMARY for Phase 04 declares a probe path. This phase's verification gates are unit-test driven (Vitest 4) + the manual layer-discipline `git diff` (covered above). Skipped — not applicable to this phase.

### Requirements Coverage

ROADMAP.md `Phase 4` declares `Requirements: None mapped (SCRUM-49 is a UX enhancement on the shipped UI shell — not in the v1 requirements set in REQUIREMENTS.md). Source: SCRUM-49 (refined 2026-05-14 against the live codebase).`

Phase 04 is therefore not bound to any `REQ-*` IDs in `.planning/REQUIREMENTS.md`. The authoritative contract is SCRUM-49 + the 9 LOCKED decisions in `04-CONTEXT.md` + the 7 Success Criteria in ROADMAP. All have been verified in the tables above. No orphaned requirements detected for Phase 04.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No `TBD`, `FIXME`, `XXX`, `HACK`, `PLACEHOLDER`, `TODO`, `coming soon`, `not yet implemented`, or `not available` markers in any of the 9 changed source files (4 widgets + WidgetCard + globals.css + constants + vitest.config + package.json). `grep -nE "TBD|FIXME|XXX|HACK|PLACEHOLDER|TODO" components/widgets/*.tsx components/widgets/__tests__/*.tsx app/globals.css lib/constants.ts vitest.config.ts` returns 0 hits. The only "stub-shaped" grep matches (`= null`, `= undefined`, `= []`) live inside *.test.tsx fabrication helpers or test fixtures, which are explicitly excluded by the stub classification rule. |

No blockers. No warnings. No notable info-level findings.

### Human Verification Required

The three items below are the residual gates that cannot run in jsdom or grep. VALIDATION.md explicitly lists them under `Manual-Only Verifications`.

#### 1. D7 / SC-5: Three-column grid balance at >=1280px

**Test:** Run `npm run dev`. Open localhost:3000. Resize the browser to viewport widths **1280px**, **1440px**, and **1920px** in turn. At each width, eyeball the three columns (left: TrendingWidget + SentimentWidget; center: HeroStoryCard + YouTube + News stacked; right: Reddit + X). Optionally capture screenshots into `playwright-qa-screenshots/04-*.png` (gitignored).
**Expected:** The three columns' bottoms do not diverge dramatically. The side columns may finish before the center — this is acceptable per CONTEXT.md D7. The dashboard does not look broken. All four feed widgets show 15 rows with a scrollable body capped at `max-h-[320px]`, and a bottom-fade is visible on each when content overflows.
**Why human:** No visual-regression tooling in this repo. Column balance is a perceptual judgement against a live grid that depends on viewport height, font rendering, and live data lengths — not reducible to a jsdom assertion.

#### 2. D6 / SC-7: Cross-browser scrollbar + fade behavior

**Test:** Open the dashboard in **Chrome (or Safari)** and **Firefox** at any >=1280px viewport. In each browser: (a) hover over a feed card → check the thin 4px scrollbar fades in (WebKit) or is already visible (Firefox); (b) move the mouse off the card → WebKit fades the scrollbar out, Firefox keeps it visible; (c) scroll a card to the bottom → the gradient fade overlay disappears; (d) scroll back up → fade reappears.
**Expected:** All four behaviors render identically across browsers within the documented per-engine differences. No flash of unstyled scrollbar; no permanent fade obscuring the last row.
**Why human:** WebKit's `::-webkit-scrollbar` pseudo-elements are not implemented in jsdom, and `scrollbar-width: thin` is a Firefox-engine feature. Neither can be asserted in this test harness.

#### 3. D8: Keyboard focus + arrow-key scroll

**Test:** With the dashboard open in Chrome, press Tab repeatedly until focus enters a feed widget. Confirm the scroll container shows the `focus-visible:ring-1 focus-visible:ring-accent` ring (a thin purple ring inset on the card body). With the container focused, press Arrow Down repeatedly → the items scroll. Press Tab once more → focus moves to the first inner `<a>` row inside that widget without the container "stealing" focus back.
**Expected:** Visible focus ring on the scroll region; arrow keys scroll; tab order continues into inner anchors.
**Why human:** The classnames are asserted by `WidgetCard.test.tsx` Test 5, but the actual `:focus-visible` rendering and keyboard input flow require a real browser.

### Gaps Summary

**No programmatic gaps.** All 9 LOCKED decisions (D1-D9) and 6 of the 7 ROADMAP success criteria are satisfied at the codebase level:

- D1 / SC-1 layer-discipline gate is empty (`git diff --stat 002d793..HEAD -- lib/api/{youtube,reddit,twitter,news,trending,hero}.ts` produces zero output)
- D2 / SC-1 constant location: `MAX_FEED_ITEMS = 15` exported once from `lib/constants.ts`, imported by exactly the four feed widgets
- D3-D5 / SC-2-SC-3: WidgetCard scrollable contract, fade overlay, scroll-aware visibility — implemented + unit-tested
- D6 / SC-4: `.scrollbar-thin` utility in `app/globals.css` with WebKit + Firefox + hover-toggle rules
- D8 / SC-2: a11y attributes + focus-visible classes — implemented + unit-tested
- D9 / SC-2 (badge preservation): live array-length badges preserved on YouTube + News; static badges preserved on Reddit + X
- SC-6 (tests green): 128/128 tests pass; `tsc --noEmit` clean; `lint` clean

D7 (column balance), SC-5 (three-column balance) and SC-7 (cross-browser) are routed to human verification — they are not programmatically observable, and CONTEXT.md D7 explicitly defers the height number to "implementation review". The implementation chose a uniform `max-h-[320px]` across the four widgets and CONTEXT.md D7's acceptance bar is *column balance, not a fixed px table*, which can only be evaluated visually.

**Recommendation:** Run the three human-verification items in section above. If all three pass, the phase goal is achieved end-to-end. If any of the three fail, file a follow-up issue rather than reopening Phase 04 — the codebase contract (D1-D9) is fully delivered; remaining items are visual / interaction polish under D7's explicit "deferred to implementation review" clause.

---

*Verified: 2026-05-15T04:35:25Z*
*Verifier: Claude (gsd-verifier)*
*Branch: feature/scrum-49-scrollable-feeds (off develop)*
*Phase-start commit: 002d793 (`docs(04): plan Phase 4 (SCRUM-49 scrollable feed cards) — 8 plans across 3 waves`)*
*Verification-time HEAD: d491475 (`docs(phase-04): update tracking after wave 4 (phase complete)`)*
