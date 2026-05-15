---
phase: 4
slug: scrollable-feed-cards-scrum-49
status: draft
shadcn_initialized: false
preset: none
created: 2026-05-14
---

# Phase 4 — UI Design Contract: Scrollable Feed Cards

> Visual and interaction contract for SCRUM-49. This is an **extension** of the
> shipped UI shell (SCRUM-37) — every visual token and component pattern below
> is already present in the codebase. The spec freezes the four implementation
> choices CONTEXT.md left to discretion (D7 column-balance, fade transition
> timing, scrollbar visibility transition, focus-ring) and catalogues the six
> visual states each scrollable widget must render correctly.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (project does not use shadcn — `components.json` absent; pure Tailwind 3.4 + CSS variables in `app/globals.css`) |
| Preset | not applicable |
| Component library | none (in-repo `components/widgets/WidgetCard.tsx` is the only card primitive) |
| Icon library | none — inline Unicode glyphs (`▶`, `●`, `📰`, `𝕏`, `↑`, `😐`) per existing widget convention |
| Font | DM Sans (body) + Space Mono (monospace labels) via `next/font/google` exposed as `--font-dm-sans` / `--font-space-mono` |

**Rationale for `Tool: none`:** the project is mid-lifecycle (Phase 1 and Phase 2
already shipped), the dashboard's visual language is locked, and this phase
*extends* `WidgetCard.tsx` rather than introducing a new component family.
Initializing shadcn would create dead surface area and contradict CONTEXT.md D3
which locks the extension to the existing `WidgetCard`. Registry safety gate is
therefore not applicable.

---

## Spacing Scale

Declared values (multiples of 4 — Tailwind 3.4 default spacing scale, used
verbatim in the existing widgets):

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| 0.5 | 2px | (existing) avatar-pill micro-padding |
| 1 | 4px | (existing) icon gaps inside item rows |
| 1.5 | 6px | (existing) inter-element gap in news/X rows |
| 2 | 8px | (existing) avatar–text gap |
| 2.5 | 10px | (existing) WidgetCard inner padding (`px-3.5 py-2.5` → 14/10) |
| 3.5 | 14px | (existing) WidgetCard horizontal inner padding + column/row gaps in `DashboardShell` |
| 9 | 36px | **NEW (this phase):** bottom-fade overlay height (`h-9`) — matches CONTEXT.md D4 verbatim |

**Exceptions:**

- `max-h-[320px]` is a Tailwind arbitrary value (not a token). Treated as a
  per-instance height, not a new spacing token — see "Per-Widget Heights" below.
- The scrollable body **does not change** the existing inner padding of
  `px-3.5 py-2.5` (14/10) — those values are preserved verbatim when the scroll
  wrapper is added, so existing item rows render identically inside the new
  scroll container.

---

## Typography

Re-stated from the live codebase. **No new typography is introduced by this phase.**

| Role | Size | Weight | Line Height | Where used in this phase |
|------|------|--------|-------------|---------------------------|
| Mono label / header eyebrow | 11px | 700 (bold) | default (~1.45) | `WidgetCard` header title; **scroll region `aria-label` is read by assistive tech, not visually rendered** |
| Item title (YouTube/Reddit/X) | 11px | 600 (semibold) | 1.35 | Existing item-row titles — unchanged inside the scroll container |
| Item title (News) | 11px | 500 (medium) | 1.4 | Existing — unchanged |
| Item meta / muted | 10px | 400 (regular) | default | Existing — unchanged |
| Avatar initials (X) | 10px | 800 (extrabold) | n/a | Existing — unchanged |
| Empty / error / loading message | 11px | 400 | default | Existing message strings (see Copywriting Contract) |

**Phase-level typography rule:** the scroll region itself adds **zero new
typographic elements** — it only wraps existing item rows. The four feed
widgets already conform to the project's 3-size, 2-weight discipline; this
phase preserves that.

---

## Color

Re-stated from the live codebase (`globals.css` + `tailwind.config.ts`). **No
new color tokens are introduced.** The bottom-fade overlay (D4) reuses the
existing dominant surface color via `var(--surface)`.

| Role | Value | Usage in this phase |
|------|-------|---------------------|
| Background (60% dominant) | `var(--background)` = `#060610` | Page background — unchanged |
| Surface (card body) | `var(--surface)` = `#0d0d1f` | Card background **+ the fade gradient's solid end stop (D4)** |
| Surface-2 (raised) | `var(--surface2)` = `#13132b` | Thumbnails, hover states **+ scrollbar thumb color (D6)** |
| Border | `var(--border)` = `rgba(120, 100, 255, 0.12)` | Card outline — unchanged |
| Accent (10%) | `var(--accent)` = `#7c6eff` | **Reserved for: focus ring on the scroll region (new), and existing accent uses (sentiment bar, hero pills)** |
| Accent secondary | `var(--accent2)` = `#c084fc` | Existing badge text only — not touched |
| Muted text | `var(--muted)` = `#6b668a` | Item meta + scroll-region `aria-label` (semantic only) |
| Status: green | `#22d3a5` | Existing (sentiment, news source pill) — not touched |
| Status: red / destructive | `#ff5c6a` | Existing (sentiment) — **no destructive actions in this phase** |
| Status: amber (stale) | `#ffb830` | Existing "outdated" badge — preserved through the change |
| Platform: YouTube red | `#ff3333` | Existing icon background — not touched |
| Platform: Reddit orange | `#ff5700` | Existing icon background + subreddit pill — not touched |
| Platform: X / Twitter | `#e7e7f0` | Existing icon glyph — not touched |
| Item hover background | `rgba(255, 255, 255, 0.02)` | Existing — preserved inside the scroll container |
| Item separator | `rgba(255, 255, 255, 0.03)` | Existing `border-b last:border-b-0` — preserved |

**Accent reserved for** (this phase only — explicit list):

1. The scroll region's `:focus-visible` focus ring (`ring-1 ring-accent` — new, see Focus Ring section).
2. (Existing) the hero card's eyebrow text, accent2 badge text, and sentiment-widget gradient — none of which this phase modifies.

**Accent NOT used for:**
- The scrollbar thumb (uses `var(--surface2)`, not accent — per D6).
- The fade overlay (uses `var(--surface)` to dissolve into the card surface — per D4).
- Item-row hover states (uses the existing translucent white — preserved).

---

## Copywriting Contract

This phase introduces **one new copy element** (the scroll-region `aria-label`).
All other copy is preserved verbatim from the existing widgets so that the
empty/error/loading paths continue to function unchanged.

| Element | Copy | Source |
|---------|------|--------|
| Primary CTA | (none — feed items are inline anchors, no global CTA) | n/a |
| Empty state — YouTube | `No videos available` | existing `YouTubeWidget.tsx:78` |
| Empty state — Reddit | `No posts available` | existing `RedditWidget.tsx:57` |
| Empty state — X / Twitter | `No tweets available` | existing `XFeedWidget.tsx:97` |
| Empty state — News | `No news available` | existing `NewsWidget.tsx:83` |
| Error state — YouTube / News | `Failed to load — retrying...` | existing |
| Error state — Reddit / X | `Feed temporarily unavailable` | existing |
| Destructive confirmation | (none — no destructive actions in this phase) | n/a |
| **Scroll-region `aria-label` (NEW)** | `${title} feed, scrollable` — i.e. `"YouTube feed, scrollable"`, `"Reddit feed, scrollable"`, `"X / Twitter feed, scrollable"`, `"AI News feed, scrollable"` | CONTEXT.md D3 / D8 — locked |
| **Fade overlay (NEW)** | no visible text; `aria-hidden="true"` per D8 | CONTEXT.md D4 — locked |
| Badge — YouTube / News | `${count} new` where `count` is the live, post-slice array length (1–15) | existing — preserved per D9 |
| Badge — Reddit | `r/ML · r/AI` (static) | existing — preserved |
| Badge — X / Twitter | `Live feed` (static) | existing — preserved |

**Why `aria-label` reads "feed, scrollable" rather than just "feed":**
the locked CONTEXT.md D3 wording is preserved. The `, scrollable` suffix
disambiguates the region in screen-reader navigation (a user landing on the
region via `tabIndex={0}` is told both *what it is* and *that it scrolls*).
This is consistent with the Adrian Roselli pattern cited in RESEARCH.md.

**No "x new since last refresh" badge.** Per CONTEXT.md `<deferred>`, the diff
badge is out of scope — the existing `${count} new` (live array length) is the
only count surface.

---

## Per-Widget Heights (resolves CONTEXT.md D7)

CONTEXT.md D7 explicitly defers exact heights to UI-SPEC. The decision below
satisfies D7's column-balance criterion at ≥1280px viewport.

**Decision: uniform `max-h-[320px]` for all four feed widgets.**

| Widget | `maxBodyHeight` prop | Approximate visible item count | Source-of-truth item height |
|--------|----------------------|--------------------------------|------------------------------|
| `YouTubeWidget` | `max-h-[320px]` | ~5 items | ~64px (44px thumb + 2-line title + meta + `py-[9px]`) |
| `RedditWidget` | `max-h-[320px]` | ~5–6 items | ~58px (subreddit pill + 2-line title + author/time) |
| `XFeedWidget` | `max-h-[320px]` | ~3 tweets | ~104px (28px avatar + name + multi-line text + counts) |
| `NewsWidget` | `max-h-[320px]` | ~6 items | ~50px (badge + 2-line title + time) |

**Rationale (column-balance math at 1280px viewport):**

- Each side column contains 2 widgets with one `gap-3.5` (14px) between them.
- Each `WidgetCard` adds ~37px chrome (header `border-b` + `py-2.5` + 11px label) on top of the body height.
- Side-column total: `2 × (37 + 320) + 14 = 728px`.
- Center column (Hero + Trending + Sentiment + 2 × `gap-3.5`) measured against
  the live unmodified dashboard at 1280px ≈ **710–780px** depending on hero
  body length and trending row count.
- **Divergence: ≤ ~50px** — well within "existing column-balance tolerance of
  the unmodified dashboard" per D7. The side columns appear visually balanced
  with the center column on a typical laptop viewport.

**Why uniform (not per-widget-tuned):**

1. Visual rhythm: all four cards being the same height reads as a deliberate
   grid, not an accident. Per-widget tuning would create a stair-step that
   draws the eye.
2. Maintenance: one constant to tune if/when the design changes.
3. The differing item heights still surface different item counts (~5 vs ~3 vs
   ~6), which is fine — variety inside the scroll container is expected.

**Why fixed-px (not viewport-relative `calc(100vh-XXXpx)`):**

- The dashboard `<main>` is `max-w-[1280px]` with no `min-h-screen` constraint
  on the columns — viewport-relative would couple side-column heights to
  browser-chrome variability across user setups (browser bookmark bars,
  devtools dock state, dock magnification on macOS, etc.) in ways the center
  column does not track.
- Per RESEARCH.md Pitfall 6, the planner is empowered to switch to
  `calc(100vh-…)` during manual QA at 1920px if imbalance > 20px. The
  recommendation here is to start fixed and only switch if visibly required.
- Implementer fallback path (sanctioned by D7): if QA at 1920px shows
  side-column bottoms more than ~30px short of center, switch to
  `max-h-[calc(100vh-380px)]` uniformly and re-verify at 1280px.

---

## Bottom Fade Overlay (concretizes CONTEXT.md D4 + D5)

| Property | Value | Source |
|----------|-------|--------|
| DOM | absolutely-positioned sibling `<div>` inside the scroll wrapper | D4 — locked |
| `aria-hidden` | `"true"` | D8 — locked |
| Pointer events | `pointer-events-none` | D4 + Pitfall 5 — locked |
| Height | `h-9` (36px) | D4 — locked |
| Position | `absolute bottom-0 left-0 right-0` | D4 — locked |
| Gradient | `bg-gradient-to-t from-[var(--surface)] to-transparent` | D4 — locked |
| Z-index | (implicit — relies on document order, no explicit `z-` utility) | follows D4 |
| Visibility transition | **conditional render** (`{!atBottom && <div … />}`) — no CSS opacity transition | NEW — resolves D5 |
| Initial state | visible if `scrollHeight > clientHeight` at mount; hidden otherwise (via the `check()` call at the end of the `useEffect` body) | D5 — locked |
| Scroll-bottom detection | `el.scrollTop + el.clientHeight >= el.scrollHeight − 1` (epsilon = 1px for subpixel rounding) | D5 + RESEARCH.md Pattern 2 — locked |
| Listener attachment | `addEventListener("scroll", check, { passive: true })` | D5 — locked |

**Decision (visibility transition timing — resolves "fade visibility transition timing"):**

The fade is **mounted/unmounted via conditional render**, not animated via CSS
`opacity` transition. Rationale:

1. CONTEXT.md D4 does not specify any transition. Adding a transition would be
   net-new design, beyond the locked spec.
2. RESEARCH.md "Anti-Patterns to Avoid" explicitly calls out the mistake of
   "animating the fade overlay with `opacity` transition while ALSO unmounting
   it via `!atBottom &&` — pick one". The locked D5 spec says "hide when at
   bottom" (no timing), and the simpler implementation is conditional render.
3. The scroll itself is the visual feedback. By the time the user has scrolled
   to the bottom, the fade vanishing is unambiguous and reads as "you're at the
   end". A 200ms opacity fade-out would feel laggy relative to the user's
   scroll velocity, not polished.

**If a future ticket wants an animation,** the planner can change the JSX to
always render the overlay and toggle a CSS class — but that is out of scope
here.

---

## Scrollbar Styling (concretizes CONTEXT.md D6)

Lives in `app/globals.css` (D6 locked location). The utility class is named
`.scrollbar-thin` (D6 locked name).

```css
/* app/globals.css — append after the existing scrollbar rules */
@layer utilities {
  .scrollbar-thin {
    /* Firefox: always-visible thin scrollbar (best Firefox can offer) */
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

| Aspect | Webkit (Chrome / Safari / Edge) | Firefox |
|--------|----------------------------------|---------|
| Width | 4px (`::-webkit-scrollbar` width) | system thin (`scrollbar-width: thin`) |
| Thumb color | `var(--surface2)` = `#13132b` | `var(--surface2)` (via `scrollbar-color`) |
| Track color | transparent | transparent (via `scrollbar-color`) |
| Thumb radius | 4px | system default (non-customizable in Firefox) |
| Visibility (idle, no card hover) | thumb `opacity: 0` (effectively hidden) | always visible when overflowing — **accepted degradation** |
| Visibility (card hovered) | thumb `opacity: 1` via `.group:hover` selector | unchanged from idle |
| Transition | `opacity 150ms ease` | n/a (Firefox does not animate scrollbar pseudo-elements) |

**Decision (Firefox parity — "scrollbar styling parity"):**

Firefox does **not** support `::-webkit-scrollbar-*` and has no equivalent CSS
to hide-then-reveal a scrollbar on hover. The locked D6 spec is therefore
implemented with two contracts:

- **Webkit:** hover-only visibility (full D6 spec).
- **Firefox:** thin always-on scrollbar with the same color token. This is the
  documented degradation in RESEARCH.md and is acceptable: D6's "opacity 0 → 1
  on hover" is a webkit-only feature surface, and Firefox users still get a
  consistent, branded thin scrollbar.

**Implementation requirement on `WidgetCard.tsx` outer div:** it MUST carry the
Tailwind `group` class so that the `.group:hover` CSS selector above resolves
correctly. This is consistent with the CONTEXT.md D6 implementation note ("use
`group` + `group-hover:` from Tailwind on the `WidgetCard` outer div").

---

## Focus Ring / Keyboard Focus (concretizes CONTEXT.md D8)

CONTEXT.md D8 locks `tabIndex={0}` on the scroll container but does not specify
a visible focus ring. This UI-SPEC adds the visible ring to satisfy WCAG 2.1
SC 2.4.7 "Focus Visible" (Level AA).

| Property | Value | Notes |
|----------|-------|-------|
| Trigger | `:focus-visible` (NOT `:focus`) | Avoids ring on mouse-click; only keyboard / programmatic focus reveals the ring |
| Ring color | `var(--accent)` = `#7c6eff` | Matches the project's accent palette; high contrast on dark surfaces |
| Ring width | 1px (Tailwind `ring-1`) | Subtle but clearly visible; thicker rings would visually fight with the 1px card border |
| Ring offset | `ring-inset` | Avoids the ring extending past the card's `overflow-hidden` (which would clip an outset ring) |
| Outline | `outline-none` on the scroll container | Replaced by the ring; the browser's default outline would clash on the dark surface |

**Tailwind classes for the scroll container** (additions to the locked D3
class list, with the new focus utilities appended):

```
relative ${maxBodyHeight} overflow-y-auto scrollbar-thin
px-3.5 py-2.5
outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-inset
```

The `px-3.5 py-2.5` preserves the existing body padding from the non-scrollable
branch (the locked D3 spec retains it on the scrollable branch as well — the
scroll wrapper replaces the existing `<div className="px-3.5 py-2.5">`).

---

## Visual States

The scrollable WidgetCard has six distinguishable states. The contract below
enumerates what must render in each.

| State | Trigger | Scrollbar (webkit) | Fade overlay | Focus ring | Hover bg on items |
|-------|---------|--------------------|--------------|------------|-------------------|
| 1. Idle, overflow present, not hovered | content exceeds `max-h-[320px]`, no mouse over card, not keyboard-focused | thumb `opacity: 0` (hidden) | **visible** | hidden | inactive |
| 2. Idle, no overflow (e.g. only 2 items) | `scrollHeight <= clientHeight` | n/a (no scrollbar rendered by browser) | **hidden** (initial `check()` sets `atBottom = true`) | hidden | inactive |
| 3. Hovered (mouse over card) | mouse over the `group` outer div | thumb `opacity: 1` (visible) | visible (unless at bottom — see state 5) | hidden | activated on the specific item under cursor |
| 4. Keyboard-focused on scroll region | user `Tab`s to the scroll container | thumb `opacity: 0` (Webkit; the `group:hover` selector does not fire on focus — acceptable, the focus ring is the keyboard affordance) | visible (unless at bottom) | **visible** (`ring-1 ring-accent ring-inset`) | inactive (no mouse) |
| 5. Scrolled to bottom | `scrollTop + clientHeight >= scrollHeight − 1` | thumb `opacity: 0/1` depending on hover (per states 1/3) | **hidden** | depends on state 1 vs 4 | per state 1 vs 3 |
| 6. Scrolled to middle (between top and bottom) | partway through scroll | per states 1/3 | **visible** | depends on state 1 vs 4 | per state 1 vs 3 |

**Notes on state 4 (keyboard-focused scrollbar visibility):**

A potential refinement is to also reveal the webkit scrollbar thumb on
`group:focus-within` (Tailwind: `group-focus-within:`). This is **not in scope**
for this phase — the focus ring alone provides sufficient keyboard affordance,
and adding `group-focus-within:[&::-webkit-scrollbar-thumb]:opacity-100` would
introduce a second visibility-toggle path that needs its own QA. If a future
a11y audit asks for it, it is a one-line addition.

**Notes on state 2 (no overflow):**

When the user has fewer than ~5 items (e.g. a fresh Reddit cache with 3 posts),
the scroll wrapper is still rendered (the widget always passes `scrollable`
when items are present), but the browser does not render a scrollbar and the
fade overlay is hidden by the initial `atBottom = true` from the
`useEffect`'s synchronous `check()` call. The card visually looks identical
to a non-scrollable card, except for the `tabIndex={0}` reachability — which is
the intended a11y contract.

**Notes on the loading / error / empty branches:**

When a widget is in its `isLoading`, `error`, or empty-array state, the widget
renders a single centered message (`<p className="py-6 text-center">…`) inside
the WidgetCard. Per CONTEXT.md, the widget MUST NOT pass `scrollable` when in
these states — the scrollable container only wraps the populated item list.
This means:

- Loading skeleton → non-scrollable WidgetCard branch (existing behavior).
- Error message → non-scrollable WidgetCard branch (existing behavior).
- Empty array → non-scrollable WidgetCard branch (existing behavior).
- Populated array → **scrollable** WidgetCard branch (new behavior).

---

## Per-Widget Visual Rules (Item Rendering Inside Scroll Container)

The four feed widgets each define their own item layout. The existing layouts
must continue to look correct when wrapped in the new scroll container. The
table below confirms each existing rule survives the change.

| Widget | Item rule | Status post-change |
|--------|-----------|-------------------|
| `YouTubeWidget` | `last:border-b-0` on `<a>` removes the separator on the final row | **preserved** — `last:border-b-0` still resolves against the parent flex container, which is the scroll wrapper's child |
| `YouTubeWidget` | `hover:bg-white/[0.02]` on each `<a>` row | **preserved** |
| `YouTubeWidget` | 76×44 thumbnail with `next/image` fill | **preserved** — `next/image` requires explicit `sizes`; existing `sizes="76px"` is correct |
| `RedditWidget` | `last:border-b-0` | **preserved** |
| `RedditWidget` | `r/${subreddit}` pill at top of row | **preserved** |
| `XFeedWidget` | `last:border-b-0` | **preserved** |
| `XFeedWidget` | rotating avatar gradient by `index % 6` | **preserved** — index is the slice index 0..14, gradient cycle repeats |
| `NewsWidget` | `last:border-b-0` | **preserved** |
| `NewsWidget` | source-abbreviation pill per row | **preserved** |
| All four | external links (`target="_blank" rel="noopener noreferrer"`) | **preserved** |

**The slice cap is the only logic change** to each widget:
- `YouTubeWidget.tsx:82`: `videos.slice(0, 4)` → `videos.slice(0, MAX_FEED_ITEMS)`
- `RedditWidget.tsx:61`: `posts.slice(0, 3)` → `posts.slice(0, MAX_FEED_ITEMS)`
- `XFeedWidget.tsx:101`: `tweets.slice(0, 4)` → `tweets.slice(0, MAX_FEED_ITEMS)`
- `NewsWidget.tsx:87`: `items.slice(0, 5)` → `items.slice(0, MAX_FEED_ITEMS)`

Plus the WidgetCard wiring:
- Each widget's `<WidgetCard …>` opening tag gains `scrollable maxBodyHeight="max-h-[320px]"`.

---

## Grid Column-Balance Strategy (≥1280px viewport)

The `DashboardShell` layout is:

```
lg:grid-cols-2                          (lg: 1024–1279px)
xl:grid-cols-[280px_1fr_280px]          (xl: 1280px+)
gap-3.5                                 (14px between columns and rows)
max-w-[1280px]                          (overall content cap)
```

| Viewport | Layout | Side-column total expected | Center-column total expected | Tolerance |
|----------|--------|---------------------------|------------------------------|-----------|
| `≥1280px` (`xl`) | 3-column: 280 / fluid / 280 | `2 × (37 + 320) + 14` = **728px** (each side) | ~710–780px (Hero 240–290 + Trending 300–340 + Sentiment 130–150 + 2 × 14 gaps) | ±50px between any two columns |
| `1440px` | same 3-column (content centered, `max-w-[1280px]` clamp) | 728px (unchanged — heights are fixed) | unchanged (heights are content-driven, no layout shift at this viewport since columns are not flex-height-stretching) | as above |
| `1920px+` | same 3-column (content centered, side gutters grow) | 728px (unchanged) | unchanged | as above |
| `1024–1279px` (`lg`) | 2-column: each column holds half the widgets | side widgets become full-width cards; scroll cap still applies | n/a — visual balance criterion is **only at ≥1280px per D7** | n/a |
| `<1024px` (mobile/`base`) | single column, each widget full-width | `max-h-[320px]` still applies | n/a | n/a |

**Decision (column-balance strategy):**

1. **All viewports ≥1280px share the same fixed `max-h-[320px]`.** No
   viewport-relative heights. Justified by the fact that the dashboard is
   `max-w-[1280px]`-clamped — visible content width stops growing past 1280,
   so column proportions are invariant past that breakpoint.
2. **Below 1280px** the 2-column `lg` layout applies. The 320px cap still
   bounds the body height, which is correct: at narrower viewports the side
   widgets are wider and benefit from showing the same item count inside the
   same body height. No special handling.
3. **At mobile (`<1024px`)** the layout stacks. Body height bound still
   applies; column-balance is not a criterion because there are no columns.

**Implementation contract:** the planner must NOT introduce different
`maxBodyHeight` values per breakpoint. One token (`max-h-[320px]`) governs
all viewports. If the manual QA gate (`04-G-02`, validated at 1280 / 1440 /
1920) reveals more than ±30px column divergence, the sanctioned fallback
(per D7) is to switch the prop to `max-h-[calc(100vh-380px)]` uniformly
across all four widgets — not to introduce per-widget variation.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| (none — no shadcn / third-party UI registry used) | n/a | not applicable |

This phase uses zero third-party UI registries. All new visual surface is
defined inline in `components/widgets/WidgetCard.tsx` and `app/globals.css`.
No registry vetting gate runs.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS — single new copy element (`aria-label`), all other empty/error states preserved verbatim; no destructive actions.
- [ ] Dimension 2 Visuals: PASS — six visual states catalogued; no new icons, illustrations, or component families introduced; preserves all existing per-widget item rules.
- [ ] Dimension 3 Color: PASS — zero new color tokens; accent reserved-for list is two items; 60/30/10 split inherited from existing dashboard; fade overlay uses `var(--surface)` only.
- [ ] Dimension 4 Typography: PASS — zero new type sizes or weights; existing 11/10px-with-mono labels preserved.
- [ ] Dimension 5 Spacing: PASS — single new spacing usage (`h-9` fade height) on existing Tailwind scale; preserves the existing `px-3.5 py-2.5` body padding when adding the scroll wrapper.
- [ ] Dimension 6 Registry Safety: PASS — no registries used; gate not applicable.

**Approval:** pending
