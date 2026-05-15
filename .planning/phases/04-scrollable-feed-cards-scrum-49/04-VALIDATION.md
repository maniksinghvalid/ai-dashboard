---
phase: 4
slug: scrollable-feed-cards-scrum-49
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-14
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x (already bootstrapped) + (new) `@testing-library/react@^16`, `@testing-library/dom@^10`, `jsdom@^29` |
| **Config file** | `vitest.config.ts` (root). One required micro-change: `include` extended to `**/*.test.{ts,tsx}` so component test files are picked up. |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~2–3 seconds (existing 102 tests in ~1.3s + ~5 new component test files at ~100ms each in jsdom) |
| **DOM env strategy** | Per-file `// @vitest-environment jsdom` pragma at the top of each `*.test.tsx`. **Do NOT** add `environmentMatchGlobs` — removed in Vitest 4. |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npx tsc --noEmit && npm run lint`
- **Before `/gsd-verify-work`:** Full suite green AND manual cross-viewport QA at 1280 / 1440 / 1920 px (D7 column-balance gate — not automatable).
- **Max feedback latency:** ~3 seconds for the test suite.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-W0-01 | W0 | 0 | D10 / install | T-04-supply-chain | New devDeps pinned to major; `npm audit` clean | install | `npm install --save-dev @testing-library/react@^16 @testing-library/dom@^10 jsdom@^29 && npm audit --omit=dev` | ❌ W0 | ⬜ pending |
| 04-W0-02 | W0 | 0 | Vitest .tsx pickup | — | N/A | config | `npx vitest run components/widgets/__tests__` (must discover files) | ❌ W0 | ⬜ pending |
| 04-01-01 | 01 | 1 | D2 (constant) | — | N/A | unit | `npx vitest run lib/constants` | ⚠️ extend existing | ⬜ pending |
| 04-02-01 | 02 | 1 | D3 + D8 (WidgetCard scrollable + a11y) | — | N/A | component (jsdom) | `npx vitest run components/widgets/__tests__/WidgetCard.test.tsx` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | D3 backward-compat | — | N/A | component (jsdom) | same file as 04-02-01 (negative case) | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | D4 (fade overlay) | — | N/A | component (jsdom) | same file as 04-02-01 (overlay-present case) | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 1 | D5 (fade scroll-aware) | — | N/A | component (jsdom) | same file as 04-02-01 (`fireEvent.scroll` to bottom) | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | D1 + D9 (YouTube cap + badge) | — | N/A | component (jsdom) | `npx vitest run components/widgets/__tests__/YouTubeWidget.test.tsx` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | D1 (Reddit cap) | — | N/A | component (jsdom) | `npx vitest run components/widgets/__tests__/RedditWidget.test.tsx` | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 2 | D1 (X cap) | — | N/A | component (jsdom) | `npx vitest run components/widgets/__tests__/XFeedWidget.test.tsx` | ❌ W0 | ⬜ pending |
| 04-06-01 | 06 | 2 | D1 + D9 (News cap + badge) | — | N/A | component (jsdom) | `npx vitest run components/widgets/__tests__/NewsWidget.test.tsx` | ❌ W0 | ⬜ pending |
| 04-07-01 | 07 | 2 | D6 (.scrollbar-thin utility) | — | N/A | manual + lint | Visual confirm in Chrome/Safari/Firefox; ESLint clean on globals.css | n/a | ⬜ pending |
| 04-G-01 | gate | post-2 | D1 layer discipline | — | N/A | git-diff check | `git diff --stat <phase-start>..HEAD -- lib/api/youtube.ts lib/api/reddit.ts lib/api/twitter.ts lib/api/news.ts lib/api/trending.ts lib/api/hero.ts` MUST be empty | n/a | ⬜ pending |
| 04-G-02 | gate | post-2 | D7 column balance | — | N/A | manual QA | Manual screenshots at 1280, 1440, 1920 viewport widths; columns visually balanced | n/a | ⬜ pending |
| 04-G-03 | gate | post-2 | Cross-browser | — | N/A | manual QA | Verify Chrome + Safari (webkit thin scrollbar, hover-only) + Firefox (native thin scrollbar, always visible) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install --save-dev @testing-library/react@^16 @testing-library/dom@^10 jsdom@^29` (3 new devDependencies; verified versions on npm 2026-05-14)
- [ ] `vitest.config.ts`: extend `include` from `"**/*.test.ts"` to `"**/*.test.{ts,tsx}"`. This is the single config change required by the entire phase.
- [ ] `components/widgets/__tests__/WidgetCard.test.tsx` — covers D3, D4, D5, D8 (the WidgetCard scrollable contract — a11y, fade overlay, scroll-aware visibility, backward-compat for non-scrollable consumers)
- [ ] `components/widgets/__tests__/YouTubeWidget.test.tsx` — covers D1 (cap to 15) + D9 (badge text)
- [ ] `components/widgets/__tests__/RedditWidget.test.tsx` — covers D1
- [ ] `components/widgets/__tests__/XFeedWidget.test.tsx` — covers D1
- [ ] `components/widgets/__tests__/NewsWidget.test.tsx` — covers D1 + D9
- [ ] Extend existing `lib/constants.test.ts` (if it exists; create if not) with one assertion: `expect(MAX_FEED_ITEMS).toBe(15)`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Three-column grid balance at ≥1280px | D7 | No visual-regression tooling in repo; column balance is perceptual | Hard-reload `npm run dev` localhost:3000 at viewport widths 1280, 1440, 1920. Visually compare the three columns' bottoms — they should not diverge dramatically (the side columns may end before the center; this is acceptable as long as the dashboard does not look broken). Capture screenshots into `playwright-qa-screenshots/04-*.png` if /qa is used. |
| Cross-browser scrollbar behavior | D6 / SC-7 | Webkit-only `::-webkit-scrollbar`; Firefox uses `scrollbar-width` | Open the dev server in Chrome (or Safari) and Firefox. In webkit: hover over a feed card → thin 4px scrollbar fades in; move mouse away → fades out. In Firefox: thin native scrollbar visible at all times when content overflows. Both browsers: scrolling reveals/hides the bottom fade per D5. |
| Keyboard scrolling | D8 | Hard to assert programmatically without an interaction harness | Tab through a feed widget — focus lands on the scroll container (visible focus ring or no ring is fine, but it must be reachable). With container focused, arrow-down scrolls the items; container does not steal focus from inner `<a>` elements when items are tab-targeted afterward. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (D7/SC-7 gates are manual but are post-implementation gates, not in-wave tasks)
- [ ] Wave 0 covers all MISSING references (jsdom env + RTL install + 5 test files + 1 config line + 1 constant assertion)
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
