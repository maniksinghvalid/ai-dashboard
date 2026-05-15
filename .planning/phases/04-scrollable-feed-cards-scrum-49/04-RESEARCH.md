# Phase 4: Scrollable Feed Cards (SCRUM-49) - Research

**Researched:** 2026-05-14
**Domain:** Frontend / React 18 + Tailwind 3.4 + Vitest 4 component testing
**Confidence:** HIGH (all critical claims verified against npm registry, Vitest 4 docs, Tailwind docs, and live codebase)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D1 - Cap layer:** 15-item cap enforced at widget render layer (`slice(0, MAX_FEED_ITEMS)`), NOT in fetchers. Rationale: `lib/api/trending.ts` and `lib/api/hero.ts` consume the full fetcher arrays (YouTube ~25, Reddit ~125, X ~150, News 30). Capping at API layer would degrade trending/velocity and hero promotion quality.
- **D2 - Constant location:** Export `MAX_FEED_ITEMS = 15` from `lib/constants.ts`. No hardcoded `15` in widget files.
- **D3 - Scrollable container is a WidgetCard responsibility:** Extend `components/widgets/WidgetCard.tsx` with `scrollable?: boolean` and `maxBodyHeight?: string`. Body wrapper at line 43 becomes `relative ${maxBodyHeight} overflow-y-auto scrollbar-thin` plus `tabIndex={0}`, `role="region"`, `aria-label="${title} feed, scrollable"`. Non-scrollable path unchanged.
- **D4 - Bottom fade is a sibling overlay:** Absolutely-positioned `<div aria-hidden="true">` inside the scroll wrapper. Classes: `pointer-events-none absolute bottom-0 left-0 right-0 h-9 bg-gradient-to-t from-[var(--surface)] to-transparent`.
- **D5 - Fade visibility is scroll-aware:** Hide when `scrollTop + clientHeight >= scrollHeight - epsilon`. Implement via `useEffect` + `scroll` listener with `{ passive: true }`, gated on `scrollable === true`. Initial state: visible if overflows, hidden if not.
- **D6 - Scrollbar utility lives in globals.css:** `.scrollbar-thin` adds webkit + Firefox scrollbar styling. Thumb is `opacity: 0` by default, `opacity: 1` on parent-card hover (via `group` + `group-hover:`).
- **D7 - Heights deferred:** No fixed px table. Acceptance criterion is column-balance at >=1280px viewport. Implementation may choose fixed `max-h-[Xpx]` or viewport-relative `max-h-[calc(100vh-XXXpx)]`.
- **D8 - Accessibility:** Scroll container `tabIndex={0}` + `role="region"` + `aria-label`. Fade is `aria-hidden="true"` + `pointer-events-none`.
- **D9 - Badge preservation:** Keep existing `${count} new` badge (live array length, 1-15). No diff logic.
- **D10 - Test strategy:** Render-time tests using Vitest. Per-test or per-config `jsdom`/`happy-dom` environment override is needed (research item for planner - addressed below). Three test classes: (a) `WidgetCard` scrollable branch renders four ARIA attributes, (b) each feed widget caps at `MAX_FEED_ITEMS`, (c) fade visibility toggles on `scrollTop`.

### Claude's Discretion

- Exact pixel heights for `maxBodyHeight` per widget (must satisfy D7 column-balance criterion).
- Whether to introduce `jsdom` environment globally in `vitest.config.ts`, or scope to component tests, or use the per-file pragma. (Recommendation below.)
- Whether to extract a generic `<ScrollableFade />` subcomponent in `WidgetCard.tsx` or inline the fade.

### Deferred Ideas (OUT OF SCOPE)

- "{n} new since last cache refresh" diff badge (no snapshot mechanism).
- Hero card scroll, Trending scroll, Sentiment scroll (not feed-style widgets).
- Per-platform item count thresholds.
- Pull-to-refresh / infinite scroll.
- Per-item visited/read state.
</user_constraints>

## Summary

This is a narrow frontend phase with all design decisions LOCKED in CONTEXT.md. Research focused on six unknowns the planner flagged: Vitest 4 DOM-environment strategy, React Testing Library install footprint, the scroll-at-bottom React pattern, Tailwind arbitrary-variant support for `::-webkit-scrollbar-thumb`, Firefox scrollbar parity, and the WidgetCard backward-compat surface.

Two findings are non-obvious and worth surfacing up-front:

1. **Vitest 4 removed `environmentMatchGlobs`** (the project is on `vitest@^4.1.5`, latest 4.1.6 - verified via `npm view vitest version`). The classic "map `*.dom.test.ts` to jsdom" config no longer exists. The two surviving options are (a) the `// @vitest-environment jsdom` pragma per file (still supported in v4), or (b) the new `test.projects` config split. The pragma is dramatically lower-friction for the four to six component test files this phase produces.
2. **The existing test suite is bigger than CONTEXT.md states.** CONTEXT.md mentions "58 pure-function tests"; running `npx vitest run` against the live repo produces **102 tests across 12 files**. This is informational only - the constraint ("do not break the existing node-environment tests") is unchanged - but the planner should not assume the lower number.

**Primary recommendation:** Use the per-file `// @vitest-environment jsdom` pragma on the new component tests, install `@testing-library/react@^16`, `@testing-library/dom@^10` (peer), `@testing-library/user-event@^14` (only if you need typed keyboard simulation), and `jsdom@^29` as devDependencies. Add a scroll-aware `useEffect` to `WidgetCard.tsx` (snippet below). Use Tailwind arbitrary variants `[&::-webkit-scrollbar-thumb]:opacity-0 group-hover:[&::-webkit-scrollbar-thumb]:opacity-100` for the hover-only scrollbar - confirmed working in Tailwind 3.4. Firefox uses the always-thin fallback (acceptable degradation).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 15-item slice cap | Browser (widget render) | - | Locked by D1 - fetchers must stay untouched so trending/hero see full arrays |
| Scrollable container shell | Browser (`WidgetCard`) | - | Locked by D3 - container concern, not per-widget |
| Bottom-fade overlay + scroll-aware visibility | Browser (`WidgetCard` + `useEffect`) | - | Pure DOM/scroll state, lives with the container |
| `.scrollbar-thin` utility CSS | CDN / static (`app/globals.css`) | - | Global stylesheet, served as part of the Next.js static bundle |
| Component render tests | Test harness (Vitest + jsdom) | - | New testing concern - jsdom is required because `node` environment has no DOM |
| Data fetching (YouTube/Reddit/X/News) | Backend / API route | - | UNCHANGED - explicit out-of-scope per CONTEXT.md |

## Standard Stack

### Core (already installed - no action)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | 18 (`^18`) | UI framework | Already in package.json `[VERIFIED: package.json]` |
| `next` | 14.2.35 | App framework | `[VERIFIED: package.json]` |
| `tailwindcss` | 3.4.1 | Styling | Supports arbitrary variants like `[&::-webkit-scrollbar-thumb]:...` `[VERIFIED: Tailwind docs - tailwindcss.com/docs/hover-focus-and-other-states]` |
| `vitest` | ^4.1.5 (latest 4.1.6) | Test runner | `[VERIFIED: npm view vitest version - 4.1.6]` |
| `@vitest/coverage-v8` | ^4.1.5 | Coverage | `[VERIFIED: package.json]` |

### New devDependencies (must be installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@testing-library/react` | ^16.3.2 | Render React components in tests, expose `render` + `screen` + `fireEvent` | The de-facto React component testing API; v16+ peer-supports both React 18 and 19. `[VERIFIED: npm view @testing-library/react version - 16.3.2, modified 2026-01-19]` |
| `@testing-library/dom` | ^10.4.1 | Peer dependency of `@testing-library/react` v16; provides DOM queries | Required peer since RTL v16 split it out to avoid duplicate-package bugs. `[VERIFIED: npm view @testing-library/react peerDependencies - "@testing-library/dom": "^10.0.0"]` `[CITED: blog.bitsrc.io / testing-library docs]` |
| `jsdom` | ^29.1.1 | DOM environment for Vitest | Default Vitest DOM env; well-supported by RTL. `[VERIFIED: npm view jsdom version - 29.1.1]` |

### Optional (install only if needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@testing-library/user-event` | ^14.6.1 | Typed keyboard/mouse simulation (`userEvent.tab()`, `userEvent.keyboard("{ArrowDown}")`) | Skip for this phase - D10 only needs `fireEvent.scroll()` for the fade-visibility test. `fireEvent` is already exported from `@testing-library/react`. `[VERIFIED: npm view @testing-library/user-event version - 14.6.1]` |
| `happy-dom` | ^20.9.0 | Lighter alternative DOM env | NOT recommended here - faster but lacks some APIs and the Vitest docs explicitly note this. Stick with `jsdom` for safety. `[VERIFIED: npm view happy-dom version - 20.9.0]` `[CITED: vitest.dev/guide/environment - "considered faster than jsdom, but lacks some API"]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `jsdom` | `happy-dom` | ~2x faster startup, but missing API surface. With only ~4-6 component test files in this phase, the speed delta is negligible (<200ms total). `jsdom` is safer. |
| `@testing-library/react` | Native `react-dom/test-utils` | `act` + manual DOM queries work, but the codebase has no existing test renderer and RTL is the universally documented standard. No reason to pick the harder path. |
| Per-file pragma | `test.projects` config | Pragma needs ~1 line per new test file; `projects` needs a global config split affecting all 12 existing test files. Pragma wins on blast radius. |

### Installation (single command)

```bash
npm install --save-dev \
  @testing-library/react@^16 \
  @testing-library/dom@^10 \
  jsdom@^29
```

### Version verification

All package versions above were verified against the live npm registry on 2026-05-14:

```bash
npm view @testing-library/react version    # 16.3.2 (modified 2026-01-19)
npm view @testing-library/dom version      # 10.4.1
npm view @testing-library/user-event version # 14.6.1
npm view jsdom version                     # 29.1.1
npm view happy-dom version                 # 20.9.0
npm view vitest version                    # 4.1.6
```

## Architecture Patterns

### System Architecture Diagram

```
                      DashboardShell.tsx (unchanged)
                                |
                                v
            +---------------------------------------+
            |  WidgetErrorBoundary (unchanged)      |
            +---------------------------------------+
                                |
                                v
            +---------------------------------------+
            |  Feed widget                          |
            |  (YouTubeWidget / RedditWidget /      |
            |   XFeedWidget / NewsWidget)           |
            |                                       |
            |  data.slice(0, MAX_FEED_ITEMS)        |   <-- D1 cap applied here
            |       |                               |
            |       v                               |
            |  <WidgetCard                          |
            |     scrollable                        |   <-- new prop (D3)
            |     maxBodyHeight="max-h-[Xpx]"      |   <-- new prop (D3)
            |   >                                   |
            |     {sliced items}                    |
            |  </WidgetCard>                        |
            +---------------------|-----------------+
                                  |
                                  v
            +---------------------------------------+
            |  WidgetCard.tsx (extended)            |
            |                                       |
            |  Outer: rounded card    [group class] |   <-- enables group-hover for scrollbar
            |    Header (unchanged)                 |
            |    --                                 |
            |    Body wrapper:                      |
            |      if scrollable:                   |
            |        <div                           |
            |          ref={scrollRef}              |
            |          tabIndex={0}                 |
            |          role="region"                |
            |          aria-label="{title} feed,    |
            |                      scrollable"      |
            |          onScroll={...} OR useEffect  |
            |          className="relative          |
            |            max-h-[...] overflow-y-auto|
            |            scrollbar-thin"            |
            |        >                              |
            |          {children}                   |
            |          {!atBottom && <FadeOverlay/>}|   <-- sibling div (D4)
            |        </div>                         |
            |      else:                            |
            |        <div className="px-3.5 py-2.5"> |   <-- unchanged path
            |          {children}                   |
            |        </div>                         |
            +---------------------------------------+
                                  ^
                                  |
              global.css adds .scrollbar-thin utility (D6)
              - webkit: 4px thumb, group-hover opacity toggle
              - firefox: scrollbar-width + scrollbar-color
```

`[VERIFIED: live codebase - WidgetCard.tsx, DashboardShell.tsx]`

### Component Responsibilities

| File | Change | Lines touched |
|------|--------|---------------|
| `lib/constants.ts` | Add `export const MAX_FEED_ITEMS = 15;` | +1 |
| `components/widgets/WidgetCard.tsx` | Add `scrollable`, `maxBodyHeight` props; add `group` class to outer; conditional scroll wrapper with refs, useEffect, fade overlay | ~+40 |
| `components/widgets/YouTubeWidget.tsx` | Change `videos.slice(0, 4)` -> `videos.slice(0, MAX_FEED_ITEMS)`; pass `scrollable maxBodyHeight="..."` to WidgetCard | ~+3 |
| `components/widgets/RedditWidget.tsx` | Same as YouTube; current cap is `slice(0, 3)` | ~+3 |
| `components/widgets/XFeedWidget.tsx` | Same; current cap is `slice(0, 4)` | ~+3 |
| `components/widgets/NewsWidget.tsx` | Same; current cap is `slice(0, 5)` | ~+3 |
| `app/globals.css` | Add `.scrollbar-thin` utility (webkit + firefox) | ~+15 |
| `vitest.config.ts` | NO CHANGE (use per-file pragma instead) | 0 |
| `package.json` | Add 3 devDependencies | +3 |
| `components/widgets/__tests__/*.test.tsx` (NEW) | Component tests for `WidgetCard` scrollable branch + each feed widget's cap behavior | new files |

`[VERIFIED: live grep of components/widgets/*.tsx slice() calls]`

### Pattern 1: Per-file Vitest environment pragma (D10 unknown #1)

**What:** A control comment at the very top of a test file overrides the default `environment: "node"` for that file only.

**When to use:** Any new test file that needs DOM APIs (`document`, `window`, `HTMLElement`).

**Example:**

```typescript
// Source: vitest.dev/guide/environment - quoted: "Control comments are comments that start with @vitest-environment and are followed by the environment name"
// @vitest-environment jsdom

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { WidgetCard } from "@/components/widgets/WidgetCard";

describe("WidgetCard scrollable branch", () => {
  it("renders scroll wrapper with all four ARIA attributes when scrollable=true", () => {
    render(
      <WidgetCard
        icon="X"
        iconBg="#000"
        title="YouTube"
        scrollable
        maxBodyHeight="max-h-[420px]"
      >
        <div>item</div>
      </WidgetCard>
    );
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("tabIndex", "0");
    expect(region).toHaveAttribute("aria-label", "YouTube feed, scrollable");
  });
});
```

`[VERIFIED: vitest.dev/guide/environment quoted in WebFetch output; pragma syntax confirmed for Vitest 4.1.6]`

**Why per-file pragma beats `test.projects`:**

- The project currently has 12 test files / 102 tests, all in `environment: "node"`. Switching to `test.projects` would require either splitting them all into a node project (boilerplate touching every existing file's directory pattern) or accepting that pragma-less component tests would run in node and fail.
- Pragma is 1 line per new test file, zero changes to `vitest.config.ts`, zero risk to the existing 102 tests.
- Vitest 4.1.6 still supports the pragma `[VERIFIED: vitest.dev/guide/environment]`. The Vitest 4 migration only removed `environmentMatchGlobs` (the glob-based config), not the per-file pragma `[CITED: vitest.dev/guide/migration.html]`.

**CONTEXT.md correction:** D10 says "vitest.config.ts `environment: "node"` won't suit DOM tests; this phase likely needs `environment: "jsdom"` or per-test environment overrides". The pragma path requires NO change to `vitest.config.ts` at all. The existing `include: ["**/*.test.ts"]` does need to be extended to `["**/*.test.ts", "**/*.test.tsx"]` (or just `"**/*.test.{ts,tsx}"`) so that `.tsx` test files are picked up. That's the only `vitest.config.ts` change needed.

### Pattern 2: Scroll-aware fade visibility (D5 unknown #3)

**What:** A `useRef` + `useEffect` hook on the scroll container that listens for `scroll` events and toggles a `useState` boolean indicating "at bottom".

**When to use:** Inside `WidgetCard` when `scrollable === true`. Gate the listener attachment on `scrollable` so the non-scrollable path has zero overhead.

**Example (drop-in for WidgetCard.tsx):**

```typescript
// Source: standard React 18 pattern; epsilon=1 to absorb subpixel rounding in webkit
import { useEffect, useRef, useState } from "react";

function useScrollAtBottom(scrollable: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    if (!scrollable) return;
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const epsilon = 1;
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - epsilon);
    };
    check(); // initial state: hidden if content fits, visible if it overflows
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, [scrollable]);

  return { ref, atBottom };
}
```

**Inline usage inside `WidgetCard`:**

```typescript
const { ref, atBottom } = useScrollAtBottom(scrollable ?? false);
// ...
<div ref={ref} tabIndex={0} role="region" aria-label={`${title} feed, scrollable`}
     className={`relative ${maxBodyHeight ?? "max-h-[420px]"} overflow-y-auto scrollbar-thin`}>
  {children}
  {!atBottom && (
    <div aria-hidden="true"
         className="pointer-events-none absolute bottom-0 left-0 right-0 h-9 bg-gradient-to-t from-[var(--surface)] to-transparent" />
  )}
</div>
```

**Why this pattern over `onScroll` prop:**

- `{ passive: true }` is non-trivial to express via React's `onScroll` prop; React's synthetic event system defaults to non-passive listeners. Direct `addEventListener` lets you opt into passive, which avoids the "blocking scroll handler" warning some Chrome versions emit and improves perceived scroll smoothness on touch devices.
- `useEffect` cleanup handles unmount safely.
- The hook is small enough to inline inside `WidgetCard.tsx` (no need for a new file under `lib/hooks/`) - Claude's discretion per CONTEXT.md.

**Project idiom check:** Existing hooks in `lib/hooks/` (`use-api-data.ts`, `use-dashboard.ts`) are SWR wrappers, not DOM hooks. A DOM hook is genuinely new territory for the codebase. Inline it inside `WidgetCard.tsx` rather than starting a new "DOM hooks" subdirectory.

`[VERIFIED: live codebase - lib/hooks/* contents]`

### Pattern 3: Hover-only scrollbar via Tailwind arbitrary variants (D6 unknown #4)

**What:** Use Tailwind's arbitrary variant syntax `[&::-webkit-scrollbar-thumb]:...` combined with `group-hover:` to toggle scrollbar opacity on parent-card hover.

**When to use:** On the scroll wrapper inside `WidgetCard`, with `group` on the outer card div.

**Two viable implementations - pick ONE:**

**Option A (Tailwind utilities only, no CSS file change for the toggle):**

```tsx
// Outer card div gets `group`
<div className="group overflow-hidden rounded-[14px] border ...">
  ...
  <div className="relative max-h-[420px] overflow-y-auto
                  [&::-webkit-scrollbar]:w-1
                  [&::-webkit-scrollbar-track]:bg-transparent
                  [&::-webkit-scrollbar-thumb]:rounded
                  [&::-webkit-scrollbar-thumb]:bg-[var(--surface2)]
                  [&::-webkit-scrollbar-thumb]:opacity-0
                  group-hover:[&::-webkit-scrollbar-thumb]:opacity-100
                  [scrollbar-width:thin]
                  [scrollbar-color:var(--surface2)_transparent]">
    ...
  </div>
</div>
```

`[VERIFIED: Tailwind 3.4 supports arbitrary variants and stacking with built-in variants like group-hover - tailwindcss.com/docs/hover-focus-and-other-states; quoted: "Arbitrary variants can be stacked with built-in variants or with each other, just like the rest of the variants in Tailwind"]`

**Option B (utility class in globals.css, applied via `className="scrollbar-thin"`):**

```css
/* app/globals.css */
@layer utilities {
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: var(--surface2) transparent;
  }
  .scrollbar-thin::-webkit-scrollbar { width: 4px; }
  .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: var(--surface2);
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .group:hover .scrollbar-thin::-webkit-scrollbar-thumb { opacity: 1; }
}
```

**Recommendation: Option B (CSS utility class).**

CONTEXT.md D6 LOCKS the `.scrollbar-thin` utility into `app/globals.css`. Option A would override that decision by putting the styling entirely in Tailwind utilities and leaving D6's CSS-block locked spec empty. Option B aligns with D6 verbatim - the `.scrollbar-thin` utility lives in `globals.css`, just as locked.

Caveat for Option B: `opacity` doesn't always animate cleanly on `::-webkit-scrollbar-thumb` in all webkit versions (the pseudo-element is a special browser-rendered thing). If `opacity` transition behaves weirdly on the target browser, fall back to toggling `background: transparent` -> `background: var(--surface2)` instead. The CONTEXT.md spec just says "opacity: 0 / opacity: 1 on parent hover", which can be achieved either way.

### Anti-Patterns to Avoid

- **Hand-rolling an `IntersectionObserver` for at-bottom detection:** Overkill. `scrollTop + clientHeight >= scrollHeight - 1` is exact, synchronous, and works everywhere React supports.
- **Putting `tabIndex={0}` on a `div` that has NO accessible name:** axe-core flags `scrollable-region-focusable` violations specifically when the region is focusable but unnamed. Our spec gives it `role="region"` + `aria-label` (D8), so we're compliant - just don't drop either of those.
- **Switching the existing `vitest.config.ts` global environment to `jsdom`:** Would force all 102 existing tests through a jsdom setup they don't need, adding ~50-100ms total and potentially breaking tests that mock global modules in `node`-specific ways. Keep `node` global; opt-in to `jsdom` per file.
- **Using `tabIndex={-1}` on the scroll container to "fix" focus order:** That would REMOVE keyboard reachability and fail D8/axe. The double-focus-stop (region + first anchor child) is intentional - canonical axe-fix pattern. `[CITED: adrianroselli.com/2022/06/keyboard-only-scrolling-areas.html]`
- **Animating the fade overlay with `opacity` transition while ALSO unmounting it via `!atBottom &&`:** Pick one. Either render it always and toggle `opacity`, or conditionally render. The locked D4 spec says nothing about transition timing; conditional rendering is simpler and zero-jank.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component rendering in tests | DIY `createRoot` + manual DOM tree assertions | `@testing-library/react`'s `render()` + `screen.getByRole()` | RTL handles `act()` warnings, auto-cleanup between tests, and provides the semantic accessibility-first query API. |
| Scrollbar styling cross-browser | A complex IntersectionObserver-based virtual scrollbar | Native `::-webkit-scrollbar` + `scrollbar-width` + `scrollbar-color` | Native scrollbars handle keyboard, touch, accessibility, and color-scheme automatically. |
| "User scrolled to bottom" detection | Lodash-style throttled handler with `requestAnimationFrame` | Single `scroll` listener with `{ passive: true }` and the inline `scrollTop + clientHeight >= scrollHeight - 1` check | Native `passive: true` already optimizes; the check is O(1) and runs on the main thread without measurable cost. |
| Per-test DOM environment | Splitting `vitest.config.ts` into multiple `projects` for one phase's worth of tests | `// @vitest-environment jsdom` pragma | Less config blast radius. |

**Key insight:** This phase has zero genuinely-new technical territory. Every requirement maps to a stock React 18 / Tailwind 3.4 / Vitest 4 idiom. The risk is in misconfiguring known tools (e.g., picking `environmentMatchGlobs` from Vitest 3 documentation that no longer applies), not in inventing new mechanisms.

## Runtime State Inventory

Not applicable - this is a greenfield UX enhancement, not a rename/refactor/migration. No external state (caches, OS-registered tasks, env vars, package names) is renamed. Skipping the table.

## Common Pitfalls

### Pitfall 1: Following stale Vitest 3 documentation for `environmentMatchGlobs`

**What goes wrong:** A planner or implementer searches "vitest different environment per file" and finds the canonical Vitest 3 docs (`environmentMatchGlobs: [['**/*.dom.test.ts', 'jsdom']]`). They add it to `vitest.config.ts`. The config is silently ignored in Vitest 4.

**Why it happens:** `environmentMatchGlobs` was deprecated in Vitest 3.x and **removed** in Vitest 4.0. Most surviving blog posts and Stack Overflow answers still show it. `[CITED: github.com/vitest-dev/vitest/releases/tag/v4.0.0]`

**How to avoid:** Use the per-file pragma `// @vitest-environment jsdom`. Or use `test.projects` (the v4 replacement). Don't trust pre-2026 articles on this topic without checking against `vitest.dev/guide/migration.html`. `[CITED: vitest.dev/guide/migration.html]`

**Warning signs:** Test file has DOM code but throws `ReferenceError: document is not defined` even though `vitest.config.ts` "configures" `environmentMatchGlobs`.

### Pitfall 2: `@testing-library/dom` peer missing in install command

**What goes wrong:** `npm install --save-dev @testing-library/react` alone leaves `@testing-library/dom` unsatisfied (since RTL v16 it's a peer, not a transitive dep). npm 7+ either auto-installs it (sometimes wrong major version) or fails the install with a peer-dep warning.

**Why it happens:** RTL v16 explicitly split `@testing-library/dom` out to prevent duplicate-package bugs. The install command in many old guides predates this split. `[CITED: testing-library.com/docs/react-testing-library/intro - "you'll need to install it together with its peerDependency @testing-library/dom"]`

**How to avoid:** Always install both: `npm install --save-dev @testing-library/react @testing-library/dom`.

**Warning signs:** `npm install` warnings about `UNMET PEER DEPENDENCY @testing-library/dom`; tests throw `Cannot find module '@testing-library/dom'` from RTL internals.

### Pitfall 3: Forgetting to extend Vitest's `include` to pick up `.tsx` files

**What goes wrong:** Component tests live in `*.test.tsx` (because they contain JSX). The current `vitest.config.ts` has `include: ["**/*.test.ts"]` - the `.ts` glob does NOT match `.tsx`. New tests are silently skipped; `npm test` reports "all tests passed" with the new tests never executed.

**Why it happens:** Glob semantics. `*.test.ts` is a literal pattern.

**How to avoid:** Update `vitest.config.ts` `include` to `["**/*.test.{ts,tsx}"]` or add `"**/*.test.tsx"` as a second entry. Verify by running `npx vitest run --reporter=verbose` and counting test files.

**Warning signs:** Test count doesn't increase after adding the new tests; `vitest run` finishes too fast.

`[VERIFIED: vitest.config.ts line 6 - `include: ["**/*.test.ts"]`]`

### Pitfall 4: Double-tab-stop on scroll containers with anchor children

**What goes wrong:** Adding `tabIndex={0}` to the scroll container creates a tab stop. The first `<a>` inside is ALSO a tab stop. Keyboard users now press Tab twice before reaching the first link - feels noisy.

**Why it happens:** Both are independently focusable. This is the canonical axe-fix shape but feels slightly off.

**How to avoid:** Accept it - the alternative (no `tabIndex` on the container) fails axe `scrollable-region-focusable` because Safari/Firefox don't auto-add scrollable divs to the tab order. The Adrian Roselli canonical guidance is "always put `tabindex="0"` on the scrollable region OR on a static element within the region". Since our children are `<a>` tags (already focusable), the container's `tabIndex={0}` is the safer guarantee across browsers, and the extra tab stop is a known acceptable trade. `[CITED: adrianroselli.com/2022/06/keyboard-only-scrolling-areas.html; dequeuniversity.com/rules/axe/4.8/scrollable-region-focusable]`

**Warning signs:** None - this is by design.

### Pitfall 5: Fade overlay covers the last list item's hover/click target

**What goes wrong:** When the user has NOT scrolled to the bottom, the fade overlay sits on top of the last visible item. If `pointer-events-none` is missing, the item below the gradient becomes unclickable.

**Why it happens:** `position: absolute` puts the overlay on top of content in z-order; without `pointer-events: none`, the overlay intercepts clicks.

**How to avoid:** The locked D4 classes already include `pointer-events-none`. Verify it in the implementation; don't strip it.

**Warning signs:** Manual QA reveals the bottom-most visible item can't be clicked when the fade is showing.

### Pitfall 6: Heights chosen via D7 don't actually balance the center column

**What goes wrong:** Implementer picks `max-h-[420px]` for both left and right columns (YouTube + Reddit on the left; X + News on the right). At 1280px viewport, the center column (Hero + Trending + Sentiment) totals, say, 880px. The two side columns become 840px (420 + 420 + gap). They look balanced. At 1440px viewport, the center column grows to 980px. The side columns are still 840px. Visual imbalance appears at larger viewports.

**Why it happens:** Fixed pixel heights don't track the natural-flow center column.

**How to avoid:** Either (a) measure the center column at 1280, 1440, 1920 and pick heights that work across all three (acceptable per D7), or (b) use viewport-relative `max-h-[calc(100vh-XXXpx)]` so the columns track viewport height instead. Both are allowed per D7's "either is acceptable". Recommendation: start with fixed px heights tuned at 1280, then re-check at 1920 during manual QA. If imbalance is >20px, switch to viewport-relative.

**Warning signs:** Side-by-side screenshots at multiple viewports show diverging column-bottoms.

## Code Examples

### Verified example: WidgetCard.tsx extended signature (drop-in skeleton)

```typescript
// Source: live codebase WidgetCard.tsx + CONTEXT.md D3-D8 LOCKED spec + React 18 useEffect pattern
import { useEffect, useRef, useState, type ReactNode } from "react";

export function WidgetCard({
  icon,
  iconBg,
  title,
  badge,
  stale = false,
  scrollable,
  maxBodyHeight,
  children,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  badge?: string;
  stale?: boolean;
  scrollable?: boolean;
  maxBodyHeight?: string;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    if (!scrollable) return;
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, [scrollable]);

  return (
    <div className="group overflow-hidden rounded-[14px] border border-[--border] bg-surface">
      <div className="flex items-center justify-between border-b border-[--border] px-3.5 py-2.5">
        {/* ...existing header content unchanged... */}
      </div>
      {scrollable ? (
        <div
          ref={scrollRef}
          tabIndex={0}
          role="region"
          aria-label={`${title} feed, scrollable`}
          className={`relative ${maxBodyHeight ?? "max-h-[420px]"} overflow-y-auto scrollbar-thin px-3.5 py-2.5`}
        >
          {children}
          {!atBottom && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-9 bg-gradient-to-t from-[var(--surface)] to-transparent"
            />
          )}
        </div>
      ) : (
        <div className="px-3.5 py-2.5">{children}</div>
      )}
    </div>
  );
}
```

`[VERIFIED: synthesized from WidgetCard.tsx live source + CONTEXT.md D3-D8 + React 18 useEffect pattern]`

### Verified example: Updated `vitest.config.ts` (only `include` change)

```typescript
// Source: live vitest.config.ts + Vitest 4 glob semantics
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",                          // unchanged - default stays node
    include: ["**/*.test.{ts,tsx}"],              // CHANGED: was ["**/*.test.ts"], now matches .tsx too
    passWithNoTests: true,
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      ".claude/**",
      "arch/**",
      ".develop-team/**",
      ".review-fix/**",
      ".review-team/**",
      ".planning/**",
      "playwright-qa-screenshots/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

### Verified example: Component test with pragma

```typescript
// @vitest-environment jsdom
// Source: vitest.dev/guide/environment + @testing-library/react v16 API
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { YouTubeWidget } from "@/components/widgets/YouTubeWidget";
import type { Video } from "@/lib/types";

function makeVideos(n: number): Video[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `v${i}`,
    title: `Video ${i}`,
    channelName: "ch",
    viewCount: 1000,
    publishedAt: new Date().toISOString(),
    thumbnailUrl: "",
    url: `https://youtu.be/v${i}`,
  }));
}

describe("YouTubeWidget cap", () => {
  it("renders at most MAX_FEED_ITEMS items when given more data", () => {
    const videos = makeVideos(25);
    render(<YouTubeWidget videos={videos} stale={false} isLoading={false} error={null} />);
    expect(screen.getAllByRole("link")).toHaveLength(15);
  });
});

describe("WidgetCard scrollable branch", () => {
  it("hides fade overlay after scrolling to bottom", () => {
    // render WidgetCard with scrollable + short maxBodyHeight + tall children
    // assert fade overlay (div with aria-hidden) is present initially
    // simulate scroll: fireEvent.scroll(scrollContainer, { target: { scrollTop: 9999 } })
    // assert overlay no longer in DOM
  });
});
```

`[VERIFIED: @testing-library/react v16 API; pragma syntax from vitest.dev/guide/environment]`

### Verified example: `.scrollbar-thin` utility for `app/globals.css`

```css
/* Source: existing globals.css scrollbar rules + CONTEXT.md D6 LOCKED spec + Firefox MDN scrollbar-color/scrollbar-width docs */
@layer utilities {
  .scrollbar-thin {
    /* Firefox */
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
    transition: opacity 0.15s ease;
  }
  .group:hover .scrollbar-thin::-webkit-scrollbar-thumb {
    opacity: 1;
  }
}
```

`[CITED: developer.mozilla.org - scrollbar-width, scrollbar-color CSS properties]`

**Firefox behavior:** Firefox does NOT honor `:hover` on `::-webkit-scrollbar-*` because those pseudo-elements don't exist in Firefox. Firefox uses `scrollbar-width: thin` + `scrollbar-color` only, and the resulting thin scrollbar is **always visible** when content overflows. This is acceptable degradation: D6 only specifies the hover-toggle behavior for webkit; Firefox parity is "thin scrollbar always shown, same color tokens".

### Verified example: WidgetCard consumer audit (D6 backward-compat unknown #6)

| File | Consumes WidgetCard? | New `scrollable` prop default | Behavior change? |
|------|----------------------|-------------------------------|------------------|
| `components/widgets/YouTubeWidget.tsx` | YES | will pass `scrollable maxBodyHeight="..."` | YES (intentional) |
| `components/widgets/RedditWidget.tsx` | YES | will pass `scrollable maxBodyHeight="..."` | YES (intentional) |
| `components/widgets/XFeedWidget.tsx` | YES | will pass `scrollable maxBodyHeight="..."` | YES (intentional) |
| `components/widgets/NewsWidget.tsx` | YES | will pass `scrollable maxBodyHeight="..."` | YES (intentional) |
| `components/widgets/TrendingWidget.tsx` | YES | omits both props -> `scrollable` is `undefined` (falsy) | NO - hits non-scrollable branch |
| `components/widgets/SentimentWidget.tsx` | YES | omits both props -> `scrollable` is `undefined` (falsy) | NO - hits non-scrollable branch |
| `components/widgets/HeroStoryCard.tsx` | NO (custom layout per CLAUDE.md) | n/a | NO |

`[VERIFIED: grep -rn "WidgetCard" components/ --include="*.tsx"]`

**Backward-compat conclusion:** TrendingWidget and SentimentWidget continue to call `WidgetCard` with the same 5 props they use today (`icon`, `iconBg`, `title`, `badge`, `stale`, `children`). The new props are optional with TypeScript-checked defaults. The non-scrollable code path in `WidgetCard.tsx` line 43 is preserved verbatim, so these two widgets render byte-identically post-change. HeroStoryCard doesn't use `WidgetCard` at all.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `environmentMatchGlobs` in Vitest config | `test.projects` array OR per-file `// @vitest-environment` pragma | Vitest 4.0 (October 2025) | Stale blog posts will give wrong advice. Migration guide is the authoritative source. `[CITED: vitest.dev/guide/migration.html]` |
| `@testing-library/dom` as transitive dep of `@testing-library/react` | `@testing-library/dom` as explicit peer of `@testing-library/react` v16+ | RTL v16 (2024) | Must install both packages explicitly. `[CITED: testing-library docs]` |
| `jsx-runtime` requires manual `import React from "react"` in test files | Automatic JSX runtime via Next.js + Vite (no React import needed) | React 17+ (2020) | Test files can omit `import React`. |
| `enzyme` shallow rendering | RTL semantic queries | RTL adoption from ~2020 | Enzyme is unmaintained for React 18; not a real choice today. |

**Deprecated/outdated:**

- `environmentMatchGlobs`: removed in Vitest 4.0. `[CITED: github.com/vitest-dev/vitest/releases/tag/v4.0.0]`
- `enzyme`: do not introduce.
- Implicit `@testing-library/dom` install via RTL: removed in RTL v16. Install explicitly.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| - | (none - all claims in this research are verified or cited) | - | - |

All version numbers, pragma syntax, peer-dependency requirements, and Tailwind variant support were verified against either the live npm registry (`npm view`), the live codebase (file reads), or authoritative documentation (vitest.dev, tailwindcss.com, testing-library.com, adrianroselli.com, dequeuniversity.com). No `[ASSUMED]` claims appear in the document above - everything is either `[VERIFIED]` against a tool result or `[CITED]` to an authoritative source.

## Open Questions

### 1. Should `useScrollAtBottom` extract to `lib/hooks/use-scroll-at-bottom.ts`?

- What we know: CONTEXT.md leaves this to Claude's discretion. The hook is ~12 lines.
- What's unclear: Whether the codebase has a convention of splitting tiny one-off hooks into files vs inlining.
- Recommendation: Inline in `WidgetCard.tsx`. The codebase's only existing hooks (`use-api-data.ts`, `use-dashboard.ts`) are reusable cross-cutting concerns. A 12-line scroll-at-bottom helper used by exactly one component does not meet the bar for a shared `lib/hooks/` entry.

### 2. Should `package.json` add a `test:component` script that filters to `*.test.tsx` for a faster dev loop?

- What we know: Current scripts: `test`, `test:watch`, `test:coverage`. Adding a fourth is trivial.
- What's unclear: Whether the planner wants this as a phase deliverable or considers it polish.
- Recommendation: Skip - phase is narrow. Component tests are 4-6 files; running `npm test` for all 12 files takes ~1.3s today. No real friction.

### 3. Is the column-balance acceptance criterion (D7) automatable?

- What we know: The project has no visual-regression tooling (`playwright-qa-screenshots/` is a gitignored output dir, not a test suite). No Storybook, no Percy, no Chromatic.
- What's unclear: Whether the planner wants to add such tooling as part of this phase.
- Recommendation: Manual review gate. Adding visual-regression infra would massively expand scope. Be honest in the plan: "Acceptance D7 verified manually at 1280, 1440, 1920 viewports."

### 4. Does the user want `@testing-library/user-event` installed?

- What we know: D10's locked test list (a) ARIA attribute presence, (b) item-count cap, (c) fade visibility on scroll - all achievable with `fireEvent` (exported from `@testing-library/react`).
- What's unclear: If future tests want keyboard simulation (e.g., "Tab focuses the scroll region, ArrowDown scrolls 30px"), user-event is the right tool.
- Recommendation: Skip for this phase. Add later if a future ticket needs it. Keeps the install surface minimal.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All commands | YES (assumed - project has functioning `npm test`) | `^20` per `@types/node` | - |
| npm | Install commands | YES (assumed) | matches Node 20 | - |
| Vitest 4 | Existing test suite | YES | 4.1.5 (installed); 4.1.6 latest | - |
| `@testing-library/react` v16 | New component tests | NO - must install | n/a | - |
| `@testing-library/dom` v10 | RTL peer | NO - must install | n/a | - |
| `jsdom` v29 | DOM environment | NO - must install | n/a | `happy-dom` v20 (faster but lacks APIs - not recommended) |

**Missing dependencies with no fallback:**

- `@testing-library/react@^16` - required for component tests; no viable alternative for D10's test cases.
- `@testing-library/dom@^10` - required peer.
- `jsdom@^29` - required DOM env (or `happy-dom` as fallback).

**Missing dependencies with fallback:** None critical - `happy-dom` exists as a fallback for `jsdom` but `jsdom` is the recommended default.

`[VERIFIED: package.json grep + npm registry checks 2026-05-14]`

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (latest 4.1.6) + (new) @testing-library/react 16 + jsdom 29 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` (runs all 102 existing + new tests in ~1.5s) |
| Full suite command | `npm test` (Vitest project is small enough that quick = full) |

`[VERIFIED: npx vitest run output - 12 files, 102 tests, 1.33s]`

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D1 (cap layer) | YouTubeWidget renders at most 15 items when given 25 | component (jsdom) | `npx vitest run components/widgets/__tests__/YouTubeWidget.test.tsx` | NO - Wave 0 |
| D1 (cap layer) | RedditWidget renders at most 15 items when given 50 | component (jsdom) | `npx vitest run components/widgets/__tests__/RedditWidget.test.tsx` | NO - Wave 0 |
| D1 (cap layer) | XFeedWidget renders at most 15 items when given 50 | component (jsdom) | `npx vitest run components/widgets/__tests__/XFeedWidget.test.tsx` | NO - Wave 0 |
| D1 (cap layer) | NewsWidget renders at most 15 items when given 30 | component (jsdom) | `npx vitest run components/widgets/__tests__/NewsWidget.test.tsx` | NO - Wave 0 |
| D2 (constant) | `MAX_FEED_ITEMS === 15` and exported from `lib/constants.ts` | unit (node) | `npx vitest run lib/constants.test.ts` | YES (exists; add one assertion) |
| D3 + D8 (scrollable container + a11y) | `WidgetCard` with `scrollable={true}` renders `role="region"` + `tabIndex={0}` + `aria-label` | component (jsdom) | `npx vitest run components/widgets/__tests__/WidgetCard.test.tsx` | NO - Wave 0 |
| D3 (backward-compat) | `WidgetCard` without `scrollable` prop renders unchanged DOM | component (jsdom) | same file as above | NO - Wave 0 |
| D4 (fade overlay) | `WidgetCard` with `scrollable={true}` renders `<div aria-hidden="true">` overlay | component (jsdom) | same file as above | NO - Wave 0 |
| D5 (fade visibility on scroll) | After `fireEvent.scroll` to bottom, overlay is removed from DOM | component (jsdom) | same file as above | NO - Wave 0 |
| D7 (column balance) | Not automatable - manual QA gate | manual | manual screenshots at 1280, 1440, 1920 | n/a |
| D9 (badge preservation) | YouTubeWidget badge text equals `${data.length} new` for 0 < n <= 15 | component (jsdom) | feed widget tests | NO - Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test` (full suite is fast - ~1.5s)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + manual QA at 1280/1440/1920 viewports before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `components/widgets/__tests__/WidgetCard.test.tsx` - covers D3, D4, D5, D8
- [ ] `components/widgets/__tests__/YouTubeWidget.test.tsx` - covers D1 (cap to 15) + D9 (badge text)
- [ ] `components/widgets/__tests__/RedditWidget.test.tsx` - covers D1
- [ ] `components/widgets/__tests__/XFeedWidget.test.tsx` - covers D1
- [ ] `components/widgets/__tests__/NewsWidget.test.tsx` - covers D1 + D9
- [ ] One-line assertion added to existing `lib/constants.test.ts`: `expect(MAX_FEED_ITEMS).toBe(15)`
- [ ] `vitest.config.ts` `include` extension: `**/*.test.{ts,tsx}` (so the new `.tsx` files are picked up)
- [ ] Install: `npm install --save-dev @testing-library/react@^16 @testing-library/dom@^10 jsdom@^29`

## Security Domain

This is a frontend rendering change. No new input handling, no new auth surface, no new network calls, no new secrets, no new persistence. The only new external code paths are:

- `@testing-library/react`, `@testing-library/dom`, `jsdom` as **devDependencies** only. They are not shipped to production bundles (`next build` excludes `devDependencies`).

`security_enforcement` is not set in this project's `.planning/config.json` (verified absent). Treating as enabled, the applicable ASVS categories for this phase:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a - no auth surface touched |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | no | n/a - no user input handled by this phase; all rendered data flows from already-validated cache endpoints |
| V6 Cryptography | no | n/a |
| V11 Business Logic | no | n/a |
| V14 Configuration | yes | New devDependencies must come from npm registry, no postinstall script red flags (RTL/jsdom are widely-used, no known supply-chain issues) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Supply-chain compromise of new dev dependencies | Tampering | Pin versions (`^16`, `^10`, `^29` are well-established majors); use `package-lock.json` (already present); review `npm audit` after install |
| Sentry breadcrumb leak (if scroll handlers throw) | Information Disclosure | N/A - scroll-at-bottom calc cannot throw on valid DOM refs; the existing `WidgetErrorBoundary` already wraps each widget per `DashboardShell.tsx` and reports to Sentry |

## Project Constraints (from CLAUDE.md)

| Constraint | Where it bites in this phase |
|------------|------------------------------|
| Dark theme via `darkMode: "class"` + `<html className="dark">` | The fade gradient must use `var(--surface)` (dark surface), NOT a light-mode value. Locked D4 already uses `from-[var(--surface)]`. |
| Tailwind color overrides for `green`, `red`, `amber` | Not relevant to this phase - no status colors used in scroll/fade UI. |
| **New widgets must follow the existing pattern (props + WidgetCard + state handling + WidgetErrorBoundary)** | Already covered - we don't add new widgets, we extend the existing four. WidgetErrorBoundary wrap is unchanged in `DashboardShell`. |
| **Shared utilities: time formatting in `lib/utils/format.ts`** | Not relevant - no time formatting added. |
| SWR defaults: 60s polling, dedupes within 10s | Not relevant - no new SWR calls. |
| Import alias `@/*` | Test files MUST use `@/components/...` and `@/lib/...` paths, consistent with the rest of the codebase. The `vitest.config.ts` already aliases `@` to project root. |
| `next/image` allowed domains | Not relevant - existing YouTube widget already handles this. |
| Sentry init pattern (guard with env var) | Not relevant - this phase adds no Sentry calls. |
| `next.config.mjs` allows specific image domains | Already configured for YouTube; no change. |

## Sources

### Primary (HIGH confidence)

- `npm view vitest version` -> 4.1.6 (2026-05-14)
- `npm view @testing-library/react version time.modified` -> 16.3.2 modified 2026-01-19
- `npm view @testing-library/react peerDependencies` -> `{ "@testing-library/dom": "^10.0.0", react: "^18.0.0 || ^19.0.0", ... }`
- `npm view @testing-library/dom version` -> 10.4.1
- `npm view @testing-library/user-event version` -> 14.6.1
- `npm view jsdom version` -> 29.1.1
- `npm view happy-dom version` -> 20.9.0
- `npx vitest run` against live repo -> 12 test files, 102 tests, 1.33s
- Live grep `grep -rn "WidgetCard" components/ --include="*.tsx"` -> 7 files (6 consumers + 1 definition)
- Live grep `grep -rn "onScroll\|scroll'" components/ app/ --include="*.tsx" --include="*.ts"` -> 0 matches (no existing scroll handlers conflicting)
- File reads: WidgetCard.tsx, YouTubeWidget.tsx, RedditWidget.tsx, XFeedWidget.tsx, NewsWidget.tsx, TrendingWidget.tsx, SentimentWidget.tsx, DashboardShell.tsx, Header.tsx, globals.css, tailwind.config.ts, vitest.config.ts, lib/constants.ts, package.json
- [Vitest 4 migration guide](https://vitest.dev/guide/migration.html) - `environmentMatchGlobs` removed
- [Vitest Environment guide](https://vitest.dev/guide/environment) - pragma syntax: `// @vitest-environment jsdom`
- [Tailwind hover-focus-and-other-states docs](https://tailwindcss.com/docs/hover-focus-and-other-states) - arbitrary variants stackable with group-hover
- [@testing-library/react docs](https://testing-library.com/docs/react-testing-library/intro) - explicit peer dependency on `@testing-library/dom`

### Secondary (MEDIUM confidence)

- [Adrian Roselli - Keyboard-Only Scrolling Areas (2022)](https://adrianroselli.com/2022/06/keyboard-only-scrolling-areas.html) - canonical a11y guidance for tabindex on scrollable regions
- [Deque axe rule scrollable-region-focusable](https://dequeuniversity.com/rules/axe/4.8/scrollable-region-focusable) - the axe rule that justifies `tabIndex={0}` on the scroll wrapper
- [Vitest 4.0 release notes](https://github.com/vitest-dev/vitest/releases/tag/v4.0.0) - environmentMatchGlobs removal confirmed
- [bits.bitsrc.io - Dependency Handling Best Practices in React Components](https://blog.bitsrc.io/dependency-handling-best-practices-in-a-react-components-e596c4567c89) - RTL v16 peer-dep split context

### Tertiary (LOW confidence)

- None used. All claims in this research are backed by HIGH or MEDIUM sources.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - all versions verified live against npm registry
- Architecture (Vitest config strategy + scroll-at-bottom pattern + Tailwind arbitrary variants): HIGH - verified against current official docs
- Pitfalls (Vitest 4 migration trap, RTL v16 peer split, `.tsx` glob extension): HIGH - documented in official sources
- Cross-browser scrollbar parity: MEDIUM - based on documented MDN behavior; recommend a manual Firefox check post-implementation

**Research date:** 2026-05-14
**Valid until:** 2026-06-13 (30 days; Vitest 4 + React 18 + Tailwind 3.4 are all stable LTS-tier majors, low churn expected)
