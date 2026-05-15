# Project: AIP-Dash

## Core Value

AIP-Dash (AI Pulse Live Dashboard) is a real-time AI industry intelligence dashboard that aggregates YouTube, Reddit, X/Twitter, and news data, computes true cross-platform velocity + sentiment + spike alerts, and surfaces a hero story when the same AI topic trends on YouTube + Reddit + X simultaneously. The dashboard runs a 3-tier cron DAG every 15 minutes, caches all platform feeds in Upstash Redis, and serves a 3-column scrollable UI with per-platform 15-item feeds.

## Current State (as of v1.0 close — 2026-05-14)

**Shipped:** Data layer (SCRUM-36) + UI shell (SCRUM-37) + intelligence layer (Phase 1 / SCRUM-38) + Reddit free fallback (Phase 2) + cron concurrency & honesty hardening (Phase 3) + scrollable feed cards (Phase 4 / SCRUM-49).

**Runtime in production:**
- **Platform:** Vercel (Next.js 14 App Router) on Node.js 20
- **Storage:** Upstash Redis (caching + time-series ZSETs); no SQL store. Every key has a 4h safety TTL backstop (Phase 3, commit `94c8a73`)
- **Refresh cadence:** Upstash QStash 15-min POST (signed) is the **sole** working refresh path (Vercel daily `crons` was removed in Phase 3 — 401'd at the edge under Deployment Protection). `/api/cron/refresh` GET handler also accepts bearer-auth (`CRON_SECRET`) manual triggers.
- **Concurrency:** `refreshAllFeeds()` wrapped in a Redis distributed lock (`cron:refresh:lock`, `SET NX EX 90`) — concurrent QStash retries return HTTP 200 `{status:"locked"}` instead of double-running (Phase 3, commit `7c7c0ac`)
- **Cron summary truthfulness:** Tier 1 sources report three-state outcomes (`written` / `skipped_empty` / `fetcher_threw`) — no more all-`ok` false-greens on empty-array runs (Phase 3, commit `93b7254`)
- **Reddit ingestion:** Atom RSS feeds (`https://www.reddit.com/r/<sub>/.rss`) — the JSON API is datacenter-IP-blocked from Vercel (Phase 3, commit `94c8a73`)
- **Inference:** Together AI hosting `meta-llama/Llama-3.3-70B-Instruct-Turbo` (LLM-as-judge sentiment classifier — D8 amendment replacing cardiffnlp roberta). 35s timeout per cron cycle; 60s function ceiling (D9).
- **Instrumentation:** Sentry (client + server + edge), all guarded by `NEXT_PUBLIC_SENTRY_DSN` presence
- **UI:** Dark-only theme, DM Sans + Space Mono, Tailwind with custom token overrides. Per-platform feed widgets cap at 15 items inside a scrollable card body with scroll-aware bottom-fade overlay + focus-visible accent ring (Phase 4).
- **Test infra:** Vitest with `environment: "node"` baseline + jsdom + `@testing-library/react` for component-render tests (`.tsx` via `@vitejs/plugin-react`). 128 tests across 17 files at v1.0 close.

**Out of scope but on the v1.0 backlog:** cron tier-restructure for sentiment 35s-vs-60s budget collision, stale upstream death monitoring, spike-alert consumers, sentiment history sparkline, Reddit OAuth tripwire (2026-05-20 check). See `.planning/ROADMAP.md` "Backlog" section.

## Next Milestone Goals

> Empty — populated by `/gsd-new-milestone` when the next version is seeded.

## Active Scope

- **Epic:** SCRUM-27 (AIP-Dash)
- **Active ticket:** None at milestone close. SCRUM-49 (Phase 4) is in "In Review" on PR #17 awaiting merge.

## Constraints (live across versions)

- **Vercel function ceiling:** `app/api/cron/refresh/route.ts` exports `maxDuration = 60` (D9). Default 10s ceiling would time out the 3-tier DAG.
- **Sentiment timeout:** `TIMEOUT_MS = 35_000` for the Llama-3.3-70B chat-completion call. The original 5s budget (D7 cardiffnlp era) is no longer a release gate — `/benchmark` should NOT be used as a sentiment-leg gate.
- **Sentiment quota:** `SENTIMENT_DAILY_CHAR_BUDGET` (default ~200000) is a hard circuit breaker, atomically check-and-consumed via single `redis.eval` Lua script (Phase 3, commit `cb6f388`).
- **Trending storage:** One Redis ZSET per `(topic, platform)`, 96-slot cap, time-scored (D2). **Forbidden:** snapshot rotation, `trending:snapshot:1h` keys. Both `trending.ts` and `alerts.ts` read this shape via `lib/cache/timeseries.ts`.
- **Alerts cap:** `alerts:spikes` Redis list capped at 100 entries; every `LPUSH` followed by `LTRIM alerts:spikes 0 99`.
- **Hero threshold:** Top-3 on all 3 platforms (relaxation from ticket's literal "#1 on all 3" — D3) — must be documented inline in `app/api/hero/route.ts`.
- **Cron DAG shape:** 3 sequenced tiers, each `Promise.allSettled`. Tier 1 external fetches ‖, Tier 2 trending tally writes ZSETs, Tier 3 hero ‖ alerts ‖ sentiment.
- **Redis client:** Always `getRedis()` (lazy init) — never `new Redis()` directly. Lazy pattern is required because Upstash validates URLs at construction time and breaks `next build` when env vars are absent.
- **SWR access:** New dashboard data hooks must use `useApiData<T>()` from `lib/hooks/use-api-data.ts` — no direct `useSWR` calls.
- **`cacheSet` contract:** returns a boolean — `true` if a write occurred, `false` if the empty-array guard skipped the write. Callers must thread this signal into outcome reporting (Phase 3 SC-1).
- **Env contract drop:** `HUGGINGFACE_API_TOKEN` is **explicitly forbidden** — never reintroduce.
- **Feed widget render cap:** Each feed widget (YouTube, Reddit, X, News) slices at `MAX_FEED_ITEMS = 15` from `lib/constants.ts`. **Forbidden:** hardcoded `15` in any widget. Cap is enforced at the widget render layer only — fetchers stay untouched so trending + hero receive full pre-slice arrays (Phase 4 D1).
- **WidgetCard scrollable contract:** `WidgetCard` exposes optional `scrollable` + `maxBodyHeight` props. When `scrollable=true`, the body wrapper must include `role="region"`, `tabIndex={0}`, per-widget `aria-label`, `max-h-[N]`, `overflow-y-auto`, `.scrollbar-thin`, focus-visible accent ring, and a sibling absolutely-positioned bottom-fade overlay (Phase 4 D3-D5).
- **Key rotation observability:** Sentry surfaces 401s from the sentiment fetch leg; the client logs 401s explicitly rather than swallowing them.

## Historical Milestones (Shipped — do not plan)

| Ticket | Title | Status | Notes |
|--------|-------|--------|-------|
| SCRUM-36 | Data layer (API clients, Redis caching, cron skeleton) | done | Provides `lib/api/{youtube,reddit,twitter,news,trending}.ts`, `lib/cache/{redis,helpers}.ts`. |
| SCRUM-37 | Frontend dashboard UI (shell, widget contracts, theme) | done | Provides `DashboardShell`, `WidgetCard`, `WidgetErrorBoundary`, `HeroStoryCard`, dark theme tokens. |
| SCRUM-48 | Curated sources expansion | done (merged `0d0d928` 2026-05-14) | Extended subreddits + X user IDs + news RSS feeds. |
| SCRUM-38 | Sentiment Analysis Engine & Cross-Platform Trending | done (Phase 1) | Intelligence layer: ZSET velocity, hero auto-promotion, spike alerts, Together AI sentiment (D8 LLM-judge), Vitest bootstrap. |
| (operational) | Reddit Free Fallback | done (Phase 2) | Replaced Apify with Reddit free path; later switched to `.rss` in Phase 3 because the JSON API is datacenter-IP-blocked from Vercel. |
| (operational) | Caching & Refresh Hardening | done (Phase 3, PR #12) | Truthful cron summary, distributed lock, atomic sentiment budget, dead Vercel cron removal, 4h safety TTL, Reddit `.rss` switch. |
| SCRUM-49 | Scrollable Feed Cards | in review (Phase 4, PR #17) | 15-item cap at widget layer, scrollable card body with scroll-aware bottom-fade, focus-visible accent ring, `.scrollbar-thin` utility. |

## Key Decisions (LOCKED — carry across versions)

<details>
<summary>v1.0 decisions (D1-D9, F1-F4 from SCRUM-38 / arch/precious-leaping-wren.md)</summary>

| ID | Status | Decision | Rationale (short) |
|----|--------|----------|-------------------|
| D1 | locked | Paid inference vendor with a daily char-budget circuit breaker; drop HF Serverless entirely | HF free tier 30k chars/month vs ~57M projected |
| D2 | locked | One Redis ZSET per `(topic, platform)`, 96-slot cap, time-scored; single structure feeds 1h velocity + 24h alert baseline | Eliminates `trending:snapshot:1h` rotation race |
| D3 | locked | Hero promotes when top-3 on all 3 platforms (relaxation from literal "#1 on all 3"); inline-documented in route handler | Sparse X data means strict #1-on-all-3 rarely fires |
| D4 | locked | Cron is a 3-tier sequenced DAG with `Promise.allSettled` per tier | Any leg's failure doesn't block siblings |
| D5 | locked | `lib/topics.ts` shape: `type Topic = { id; label; aliases; wordBoundary? }` | Typed taxonomy replaces inline `AI_TERMS` array |
| D6 | locked (extended P4) | Vitest is the test framework. Phase 1 ships pure-function tests; Phase 4 extends with jsdom + RTL for component-render tests | Project's first test infrastructure |
| D7 | superseded by D8 | ~~Together AI hosting `cardiffnlp/twitter-roberta-base-sentiment-latest`~~ | Replaced because the Together batch endpoint for cardiffnlp was not in a viable shape at execution time |
| D8 | locked (amends D7) | Together AI hosting `meta-llama/Llama-3.3-70B-Instruct-Turbo` (LLM-as-judge classifier) via chat-completions; output parsed to `{label, score}` per input | Pragmatic substitution; F2 preprocessing retained because it reduces LLM token bloat |
| D9 | locked (amends F3) | Cron `maxDuration = 60`; sentiment `TIMEOUT_MS = 35_000` | F3's 30s ceiling was sized for cardiffnlp; D8's LLM-judge invalidates that sizing |
| F1 | locked | `.env.example`: add `TOGETHER_API_KEY` + `SENTIMENT_DAILY_CHAR_BUDGET`; **drop** `HUGGINGFACE_API_TOKEN` | Env contract follows D1 + D7 + D8 |
| F2 | locked (still applicable post-D8) | `preprocessText()`: `@username` → `@user`, `http*` URL → `http` | Reduces LLM token bloat / input noise |
| F3 | superseded by D9 | ~~`maxDuration = 30`~~ | Replaced (see D9) |
| F4 | locked (as policy) | If PR friction surfaces, alerts split cleanly to a follow-up PR (no consumer yet) | Known-good fallback shape for the 14-files / 5-new-modules complexity trip |

</details>

<details>
<summary>v1.0 Phase 3 decisions — cron hardening</summary>

- **`cacheSet` returns a write boolean** + pure `deriveSourceOutcome` helper; cron Tier 1 summary becomes three-state (`written` / `skipped_empty` / `fetcher_threw`)
- **`cron:refresh:lock` distributed lock** via `SET NX EX 90` + value-checked Lua release; wraps `refreshAllFeeds()`
- **Atomic sentiment daily-budget** check-and-consume via single `redis.eval` Lua script
- **Dead Vercel daily `crons`** removed from `vercel.json` (was 401'ing at the edge under Deployment Protection)
- **4h safety TTL** on every cache key (`SAFETY_TTL_SECONDS = 14400` in `cacheSet`'s `ex` option)

</details>

<details>
<summary>v1.0 Phase 4 decisions — scrollable feed cards</summary>

- **D1 (P4):** Layer discipline — 15-cap enforced at widget layer only; fetchers untouched
- **D2 (P4):** `MAX_FEED_ITEMS = 15` in `lib/constants.ts` as single source of truth
- **D3-D5 (P4):** `WidgetCard` exposes optional `scrollable` + `maxBodyHeight` props; bottom-fade is a sibling absolutely-positioned overlay (scroll-aware: unmounts at bottom); focus-visible accent ring at `#7c6eff` (`--accent`)
- **D6 (P4):** `.scrollbar-thin` utility in `app/globals.css` (not Tailwind plugin); `.group:hover` hover-toggle for WebKit + always-thin via `scrollbar-width: thin` for Firefox
- **D8 (P4):** Feed regions are tab-reachable with `tabindex="0"`, `role="region"`, per-platform `aria-label`
- **D9 (P4):** Badge contract preserved — `${count} new` reflects live array length 1-15 on YouTube + News; static labels preserved on Reddit + X

</details>

## Pointers

- **Active state:** `.planning/STATE.md`
- **Active milestone:** `.planning/ROADMAP.md` (collapsed for shipped milestones; current section empty until `/gsd-new-milestone` runs)
- **Active requirements:** `.planning/REQUIREMENTS.md` (deleted at v1.0 close; recreated by `/gsd-new-milestone`)
- **Archived milestones:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`
- **v1.0 source intel:** `.planning/intel/SYNTHESIS.md` + `.planning/intel/{decisions,requirements,constraints,context}.md` + `arch/precious-leaping-wren.md`
- **Project conventions:** `CLAUDE.md` (repo root)
