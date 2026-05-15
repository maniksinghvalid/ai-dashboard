# Phase 4: Scrollable Feed Cards (SCRUM-49) — Context

**Gathered:** 2026-05-14
**Status:** Ready for planning
**Source:** SCRUM-49 (Jira story refined against the live codebase 2026-05-14 — treated as authoritative PRD)

<domain>
## Phase Boundary

This phase makes the four **feed-style** widgets (YouTube, Reddit, X/Twitter, News) render up to 15 items inside a **scrollable card body** with a bottom-fade cue. The 15-item cap is enforced **only at the widget render layer** — fetchers and the trending/velocity pipeline are not touched.

In-scope artifacts:
- `lib/constants.ts` (add `MAX_FEED_ITEMS = 15`)
- `components/widgets/WidgetCard.tsx` (extend with `scrollable` + `maxBodyHeight` props, bottom-fade overlay, a11y attributes)
- `components/widgets/YouTubeWidget.tsx`, `RedditWidget.tsx`, `XFeedWidget.tsx`, `NewsWidget.tsx` (slice cap + WidgetCard wiring)
- `app/globals.css` (`.scrollbar-thin` utility for webkit + Firefox)
- Render-time unit/component tests covering the `scrollable` branch and the slice cap

Out of in-scope artifacts (explicit exclusions):
- `lib/api/youtube.ts`, `lib/api/reddit.ts`, `lib/api/twitter.ts`, `lib/api/news.ts` — **must not be touched**
- `lib/api/trending.ts`, `lib/api/hero.ts` — must continue to consume the full pre-slice fetcher arrays
- `HeroStoryCard.tsx`, `TrendingWidget.tsx`, `SentimentWidget.tsx` — not feed widgets, out of scope
- "{n} new since last cache refresh" badge — no underlying diff mechanism; separate ticket

</domain>

<decisions>
## Implementation Decisions

### D1 — Cap layer (LOCKED)
- The 15-item cap is enforced at the **widget render layer** (`slice(0, MAX_FEED_ITEMS)`), NOT in the fetchers.
- **Why:** `lib/api/trending.ts` and `lib/api/hero.ts` consume the full fetcher arrays (YouTube ~25, Reddit ~125, X ~150, News 30 today). Capping at the API layer would degrade trending/velocity and hero promotion quality.

### D2 — Constant location (LOCKED)
- Export `MAX_FEED_ITEMS = 15` from `lib/constants.ts` alongside the existing `CACHE_KEYS` / `CACHE_MAX_AGE` exports.
- No hardcoded `15` allowed in widget files.

### D3 — Scrollable container is a WidgetCard responsibility (LOCKED)
- Extend `components/widgets/WidgetCard.tsx` with optional props:
  - `scrollable?: boolean`
  - `maxBodyHeight?: string` (Tailwind arbitrary value, e.g. `"max-h-[420px]"`)
- When `scrollable` is true, the body wrapper (currently `<div className="px-3.5 py-2.5">{children}</div>` at `WidgetCard.tsx:43`) becomes `relative ${maxBodyHeight} overflow-y-auto scrollbar-thin` AND receives `tabIndex={0}`, `role="region"`, `aria-label={`${title} feed, scrollable`}`.
- The non-scrollable path is unchanged (preserves the contract for `HeroStoryCard`, `TrendingWidget`, `SentimentWidget`).

### D4 — Bottom fade is a sibling overlay, not a `::after` pseudo (LOCKED)
- Implement the fade as an absolutely-positioned sibling `<div aria-hidden="true">` inside the scroll wrapper.
- Classes: `pointer-events-none absolute bottom-0 left-0 right-0 h-9 bg-gradient-to-t from-[var(--surface)] to-transparent`.
- **Why:** Tailwind has no first-class `::after` utility with arbitrary gradients; a sibling overlay is idiomatic in this codebase and easier to scope visibility on scroll.

### D5 — Fade visibility is scroll-aware (LOCKED)
- The fade is hidden when the scroll container reaches the bottom (`scrollTop + clientHeight >= scrollHeight - epsilon`).
- Implement with a small `useEffect` + `scroll` listener (with `passive: true`) inside `WidgetCard`, gated on `scrollable === true`. Cleanup on unmount.
- Initial state: visible if content overflows; hidden if it doesn't.

### D6 — Scrollbar utility lives in globals.css (LOCKED)
- Add a `.scrollbar-thin` utility class to `app/globals.css`:
  - Webkit: `width: 4px`, `background: transparent` for track, rounded thumb in `var(--surface-2)`.
  - Firefox: `scrollbar-width: thin; scrollbar-color: var(--surface-2) transparent;`.
- Visibility: scrollbar thumb is `opacity: 0` by default and `opacity: 1` on `:hover` of the parent card (use `group` + `group-hover:` from Tailwind on the `WidgetCard` outer div).

### D7 — Heights are NOT fixed numbers in the ticket (LOCKED)
- The original SCRUM-49 prescribed 420/400/440/360 px. Those numbers were not validated against the live grid. **Defer specific heights to implementation review.**
- Acceptance criterion is column-balance, not a fixed px table: "the three columns do not visibly diverge in height by more than the existing column-balance tolerance of the unmodified dashboard at ≥1280px viewport."
- Implementation may choose to (a) pick heights that approximately match the center column at typical viewport heights, or (b) make heights viewport-relative (`max-h-[calc(100vh-XXXpx)]`). Either is acceptable so long as D5 and column balance hold.

### D8 — Accessibility (LOCKED)
- Scroll container gets `tabIndex={0}` so keyboard users can focus it and scroll with arrow keys.
- `role="region"` + `aria-label` declares it as a named landmark.
- Fade overlay is `aria-hidden="true"` and `pointer-events-none`.

### D9 — Item count badge (LOCKED behavior preservation)
- Keep the existing dynamic `${count} new` badge in each widget (e.g. `YouTubeWidget.tsx:67`). No new "since last refresh" diff logic.
- Badge value = live array length (1–15), as today.

### D10 — Test strategy (LOCKED)
- Render-time tests using the existing Vitest setup (`vitest.config.ts` `environment: "node"` won't suit DOM tests; this phase likely needs `environment: "jsdom"` or per-test environment overrides — surface this as a **research item** for the planner). Component tests cover:
  - `WidgetCard` with `scrollable={true}` renders the scroll wrapper with the four required ARIA attributes.
  - Each of the four feed widgets renders at most `MAX_FEED_ITEMS` items when given more data.
  - Fade visibility toggles based on scrollTop (mock or simulate).
- Snapshot/CSS testing is not required (Tailwind utilities are not unit-tested).

### Claude's Discretion
- Exact pixel heights for `maxBodyHeight` per widget (must satisfy D7 column-balance criterion).
- Decision on whether to introduce a `jsdom` environment in `vitest.config.ts` or to add component tests under a separate config block. Planner should treat this as a small research / setup task.
- Whether to add a generic `<ScrollableFade />` subcomponent inside `WidgetCard.tsx` or inline the fade — judgment call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source spec
- `SCRUM-49` (Jira — refined 2026-05-14) — Authoritative PRD. Live at `https://prabhneet.atlassian.net/browse/SCRUM-49`.

### Existing UI contract (must conform)
- `components/widgets/WidgetCard.tsx` — Current shape (~47 lines); extension point.
- `components/widgets/YouTubeWidget.tsx` — Current `slice(0, 4)` cap at line 82.
- `components/widgets/RedditWidget.tsx` — Current `slice(0, 3)` cap.
- `components/widgets/XFeedWidget.tsx` — Current `slice(0, 4)` cap.
- `components/widgets/NewsWidget.tsx` — Current `slice(0, 5)` cap.
- `components/widgets/WidgetErrorBoundary.tsx` — wraps each widget in `DashboardShell`; not modified by this phase.
- `components/DashboardShell.tsx` — Grid layout (`lg:grid-cols-2 xl:grid-cols-[280px_1fr_280px]`); not modified by this phase.

### Existing styling tokens
- `app/globals.css` — Existing CSS vars (`--surface`, `--surface-2`, `--border`, `--accent`, etc.). Scrollbar utility lands here.
- `tailwind.config.ts` — Existing color palette and surface tokens.
- `CLAUDE.md` — "Dark theme" + "Tailwind color overrides" + "New widgets" sections (Key Patterns).

### Out-of-scope guardrails (must NOT be touched)
- `lib/api/youtube.ts`, `lib/api/reddit.ts`, `lib/api/twitter.ts`, `lib/api/news.ts` — fetchers stay as-is.
- `lib/api/trending.ts`, `lib/api/hero.ts` — pipeline consumers stay as-is.

### Project-level guardrails
- `CLAUDE.md` — "Widget pattern", "Tailwind color overrides", "Shared utilities", "SWR defaults" sections.
- `.planning/PROJECT.md` — Project decisions; cross-reference if planner needs UI tokens.

</canonical_refs>

<specifics>
## Specific Ideas

- **Layer discipline test:** add a sanity test that `git diff --stat HEAD~..HEAD -- lib/api/youtube.ts lib/api/reddit.ts lib/api/twitter.ts lib/api/news.ts` shows zero changes during the phase commits (manual verification or a `npm run lint:no-fetcher-edits` script — judgment call).
- **Render-time slice with `Math.min`:** `videos.slice(0, MAX_FEED_ITEMS)` is sufficient — `Array.slice` already clamps to length, no `Math.min` needed.
- **`group` pattern for hover-only scrollbar:** `WidgetCard.tsx`'s outer div gets `group`; the scroll wrapper gets a `group-hover:scrollbar-thumb-visible` (or equivalent — define exact utility behavior in plan).
- **jsdom environment:** existing Vitest config is `environment: "node"`. Component-render tests will need `environment: "jsdom"` either globally (with `happy-dom` or `jsdom` installed) or via a per-file `// @vitest-environment jsdom` pragma. Cheapest path: pragma per test file.
- **No new icons or visual tokens needed** — the fade reuses `var(--surface)`.

</specifics>

<deferred>
## Deferred Ideas

- "{n} new since last cache refresh" diff badge — requires a snapshot mechanism (cache previous result, diff on render). Net-new feature; out of scope.
- Hero card scroll, Trending scroll, Sentiment scroll — they are not feed-style widgets.
- Item count threshold dynamic per platform (e.g. YouTube 12, Reddit 20) — out of scope; cap is uniform.
- Pull-to-refresh / infinite-scroll — out of scope; cap is hard-15.
- Per-item visited/read state — out of scope.

</deferred>

---

*Phase: 04-scrollable-feed-cards-scrum-49*
*Context gathered: 2026-05-14 via SCRUM-49 PRD-express path (Jira ticket refined against live codebase before planning)*
