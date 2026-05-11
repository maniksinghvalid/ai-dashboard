# Phase 1: SCRUM-38 Implementation - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Source:** PRD Express Path (`arch/precious-leaping-wren.md`)

<domain>
## Phase Boundary

Activate the dashboard's intelligence layer on top of the already-shipped data layer (SCRUM-36) and UI shell (SCRUM-37). This phase ships, end-to-end:

- **Sentiment Analysis Engine** — Together AI batch sentiment via `cardiffnlp/twitter-roberta-base-sentiment-latest`, exposed at `GET /api/sentiment`.
- **Cross-Platform Trending Engine** — Replace the count + log2 heuristic with true `(count_now − count_1h_ago) / 1h` velocity, sourced from a typed taxonomy and a unified time-series ZSET.
- **Hero Auto-Promotion** — Cross-platform topic detection (top-3 on YouTube + Reddit + X) exposed at `GET /api/hero` with widget-side fallback to the existing `deriveHeroStory()`.
- **Spike Alerts** — Velocity > 5× the 24h baseline writes to `alerts:spikes` (capped at 100, no consumer in this phase).
- **3-tier cron DAG** — Restructures `app/api/cron/refresh/route.ts` to orchestrate the new legs without blocking siblings.
- **Vitest bootstrap** — Project's first test framework; covers the pure-function core (5 test files).
- **Dashboard wiring + sentiment widget polish** — Live data replaces the placeholder, wired through `useApiData`.

**Out of scope for this phase** (deferred to v2):
- Spike-alert consumers (toast/email/Slack)
- Sentiment history/sparkline view
- Multi-provider fallback chain
- `/api/sentiment` stale fallback

</domain>

<decisions>
## Implementation Decisions

All entries below are **LOCKED** — derived from the embedded `/plan-eng-review` GSTACK REVIEW REPORT and the user's pre-planning decisions. Planner agents must NOT re-debate them.

### Sentiment provider + budget (D1, D7, F1)

- **D1** — Sentiment inference goes through a **paid vendor** with a daily char-budget circuit breaker. HuggingFace Serverless is dropped entirely.
- **D7** — **Together AI** is the chosen provider, hosting `cardiffnlp/twitter-roberta-base-sentiment-latest`. New env var: `TOGETHER_API_KEY`. Together's batch endpoint meets the 5s budget natively.
- **F1** — `.env.example` adds `TOGETHER_API_KEY` and `SENTIMENT_DAILY_CHAR_BUDGET` (default ~200000). `HUGGINGFACE_API_TOKEN` is explicitly **forbidden** — never introduce it.
- **F2** — `lib/api/sentiment.ts` ships `preprocessText()` that replaces `@username` → literal `@user` and any `http*` URL → literal `http`. Required by the cardiffnlp model card. Must be unit-tested.

### Time-series storage (D2)

- One Redis **ZSET per `(topic, platform)`**, time-scored, capped at **96 slots**. This single structure feeds both:
  - The 1h velocity calculation (`zrangeWindow(now-3600, now)` minus `zrangeWindow(now-7200, now-3600)`).
  - The 24h spike-alert baseline.
- **No snapshot rotation**, no `trending:snapshot:1h` key. The synthesizer flagged the rotation race condition explicitly; do not reintroduce it.

### Hero threshold (D3)

- A topic is hero-eligible when it appears in the **top 3 on all 3 platforms** (YouTube AND Reddit AND X), ranked by aggregate velocity. This is a deliberate relaxation from the SCRUM-38 ticket's literal "#1 on all 3" wording — sparse X data made strict #1 rarely fire. `app/api/hero/route.ts` must document this relaxation inline so future readers don't silently re-tighten it.

### Cron orchestration (D4, F3)

- `app/api/cron/refresh/route.ts` runs as a **3-tier sequenced DAG**, each tier wrapped in `Promise.allSettled`:
  - **Tier 1**: external fetches (YouTube, Reddit, X, news) in parallel.
  - **Tier 2**: trending tally writes ZSETs (depends on Tier 1).
  - **Tier 3**: hero promoter ‖ alerts ‖ sentiment (depend on Tier 2, parallel to each other).
- Failure of any leg must not block siblings or downstream-tier siblings where they are independent (existing pattern).
- **F3** — Must `export const maxDuration = 30`. The DAG hits ~12s under load; Vercel's default 10s is too tight.

### Topic taxonomy (D5)

- `lib/topics.ts` exports `AI_TOPICS: Topic[]` with shape:
  ```ts
  type Topic = { id: string; label: string; aliases: string[]; wordBoundary?: boolean }
  ```
- Substring matching by default; `wordBoundary: true` for collision-prone topics (e.g., "agents").
- Coverage: GPT-5, Claude, Gemini, ARC-AGI, agents, local LLMs — extensible.
- Replaces the inline `AI_TERMS` array in `lib/api/trending.ts`.

### Test framework (D6)

- **Vitest** is the first test framework. Bootstrap now.
- Test the pure-function core only — skip route handlers.
- Required test files:
  - `lib/topics.test.ts`
  - `lib/api/sentiment.test.ts` (covers `preprocessText` per F2 and aggregation)
  - `lib/api/trending.test.ts` (covers velocity calc + hero promotion threshold)
  - `lib/api/alerts.test.ts` (covers spike detection)
  - `lib/cache/timeseries.test.ts`
- Package additions: `vitest`, `@vitest/coverage-v8`, `tsx`. Scripts: `test`, `test:watch`, `test:coverage`.
- `vitest.config.ts` uses `environment: "node"` and aliases `@/*` to project root.
- CLAUDE.md "Commands" section must add `npm test`.

### timeseries wrapper (CON-timeseries-api)

- `lib/cache/timeseries.ts` exposes **exactly**: `zaddTimepoint(key, ts, count)`, `zrangeWindow(key, fromTs, toTs)`, `capToSlots(key, maxEntries)`.
- Both `lib/api/trending.ts` (write) and `lib/api/alerts.ts` (read 24h baseline) consume this wrapper. No direct `getRedis().zadd()` calls scattered across modules.

### Hero-card flicker policy

- On first paint and on 503 from `/api/hero`, `HeroStoryCard` falls back to the existing client-side `deriveHeroStory()`. Never blank the card during fetch.

### Alerts cap (CON-alerts-spikes-cap)

- Every `LPUSH alerts:spikes <json>` must be immediately followed by `LTRIM alerts:spikes 0 99`. `LLEN alerts:spikes` ≤ 100 at all times.

### Scope-trip fallback (F4)

- 14 files / 5 new modules trips both project complexity triggers. User pre-committed to bundle alerts in. **Mitigation**: if friction surfaces during implementation, alerts (`lib/api/alerts.ts`, alerts ZSET reads, spike thresholds) split cleanly to a follow-up PR — they have no consumer yet, so they are cleanly separable.
- This is an acknowledged decision point, NOT a default action.

### Observability (CON-key-rotation-observability)

- Sentry must surface 401s from the sentiment fetch leg. Sentiment client should log 401s explicitly (not swallow) so a rotated/expired `TOGETHER_API_KEY` doesn't silently kill the widget.

### Claude's Discretion

Areas not nailed down by the SPEC — planner/executor judgment, must still respect locked decisions and existing patterns:

- **Together AI batch endpoint** — specific request shape, batch size (≤100), and retry/timeout policy within the 5s budget. Use the official Together AI client or `fetch` with their REST API; either is acceptable.
- **`preprocessText()` implementation** — exact regex form (must produce the cardiffnlp-required `@user` / `http` literals).
- **Vitest mocking** — Redis/SWR can be mocked at the boundary. Pure-function tests should not touch the network.
- **HeroStoryCard fallback wiring** — exact React state pattern for the 503/loading → `deriveHeroStory()` fallback.
- **Sentiment widget visuals** — the CONTEXT decision is "polish the widget per the existing dark theme tokens" (`--surface-2`, `--accent`, `--accent-secondary`). A small mockup HTML committed to `arch/` is encouraged but the executor may iterate inline given the design reference already exists at `arch/ai_pulse_dashboard.html`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The plan source (authoritative)
- `arch/precious-leaping-wren.md` — Full SCRUM-38 build plan with embedded `/plan-eng-review` GSTACK REVIEW REPORT. The locked decisions above are extracted from this file.

### Synthesized intel (also authoritative — already locked)
- `.planning/intel/decisions.md` — 11 locked decisions (D1–D7 + F1–F4) with sources.
- `.planning/intel/constraints.md` — 13 constraints (api-contract × 6, schema × 1, nfr × 6).
- `.planning/intel/requirements.md` — 10 requirements with detailed acceptance criteria.
- `.planning/intel/context.md` — Project background and shipped milestones.
- `.planning/REQUIREMENTS.md` — Top-level traceability table.
- `.planning/ROADMAP.md` — Phase 1 success criteria and suggested in-phase ordering.

### Project conventions (existing code patterns to reuse)
- `CLAUDE.md` — Project-wide conventions. Read it before planning. Highlights: dark theme tokens, `getRedis()` lazy pattern, `cacheGet`/`cacheSet` helpers, `useApiData` SWR wrapper, widget contract.
- `lib/cache/redis.ts` — `getRedis()` lazy client; never use `new Redis()` directly (Upstash URL validation breaks `next build` without env vars).
- `lib/cache/helpers.ts` — `cacheGet<T>(key, maxAgeMs)` / `cacheSet<T>(key, data)`. Use everywhere EXCEPT the alerts list (raw `LPUSH`/`LTRIM`).
- `lib/hooks/use-api-data.ts` — Standard SWR wrapper. New hooks must NOT call `useSWR` directly.
- `lib/utils/format.ts` — `formatRelativeTime()` is the single source of truth for relative time strings.
- `lib/api/trending.ts` — Current `AI_TERMS` heuristic-based scorer. Will be refactored to consume `lib/topics.ts` + `lib/cache/timeseries.ts` velocity.
- `app/api/trending/route.ts` — Pattern to mirror for `app/api/sentiment/route.ts` and `app/api/hero/route.ts` (`cacheGet` with `MAX_AGE`, 503 on cold miss).
- `app/api/cron/refresh/route.ts` — Existing cron orchestrator; will be restructured into the 3-tier DAG per D4.
- `components/widgets/SentimentWidget.tsx` — Current placeholder with hardcoded sample data. Must conform to `{data, stale, isLoading, error}` widget contract.
- `components/widgets/HeroStoryCard.tsx` — Already has `deriveHeroStory()` client-side fallback; new code wires API-first behavior with that fallback.
- `components/DashboardShell.tsx` — Wraps each widget in `WidgetErrorBoundary` (the established pattern).
- `lib/types.ts` — Add `Sentiment` and `SpikeAlert`; extend `HeroStory` if cross-platform variant needs a `platforms` discriminator.
- `lib/constants.ts` — Add `CACHE_KEYS.sentiment` (15-min), `CACHE_KEYS.trendingRanked` (10-min), `CACHE_KEYS.hero` (10-min), `CACHE_KEYS.spikes`.
- `tailwind.config.ts` — Color tokens (`accent`, `accent-secondary`, `surface-2`, `green`/`red`/`amber`) and font vars. Note: `green`/`red`/`amber` override the FULL Tailwind scale — only DEFAULT/400/500 exist.
- `next.config.mjs` — Allowed image domains (`i.ytimg.com` etc.).
- `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` — Sentry init pattern (guard with `if (process.env.NEXT_PUBLIC_SENTRY_DSN)`). Sentiment 401 visibility hooks into the existing server config.

### Design reference
- `arch/ai_pulse_dashboard.html` — Existing whole-dashboard design reference. The sentiment widget polish should match its dark theme + accent palette. A new sentiment-widget-only mockup under `arch/` is encouraged but not required given this file exists.

### External docs (planner / executor may need)
- Together AI inference docs — for `cardiffnlp/twitter-roberta-base-sentiment-latest` batch invocation, request/response shape, and rate-limit handling.
- Vitest docs — config-file format, `environment: "node"`, alias resolution for `@/*`.
- Upstash Redis docs — ZSET semantics (`ZADD`, `ZRANGEBYSCORE`, `ZREMRANGEBYRANK`) used by `lib/cache/timeseries.ts`.

</canonical_refs>

<specifics>
## Specific Ideas

- **Suggested in-phase ordering** (from ROADMAP.md, planner refines):
  1. Test infrastructure (REQ-vitest-bootstrap) — unblocks everything else.
  2. Topic taxonomy (REQ-topic-taxonomy) — pure data, prerequisite for trending refactor.
  3. Time-series wrapper `lib/cache/timeseries.ts` (`CON-timeseries-api`) — prerequisite for trending + alerts.
  4. Trending velocity refactor (REQ-trending-velocity) — consumer of items 2–3.
  5. Spike alerts (REQ-spike-alerts) — consumer of item 3, hooks into item 4.
  6. Sentiment engine + route (REQ-sentiment-engine) — independent leg.
  7. Hero promoter + route (REQ-hero-auto-promotion) — consumer of items 2–4.
  8. Cron 3-tier DAG (REQ-cron-three-tier-dag) — orchestrates 4/5/6/7.
  9. Dashboard wiring (REQ-dashboard-data-wiring) — frontend consumes 6/7.
  10. Sentiment widget polish (REQ-sentiment-widget-polish).
  11. Env contract + CLAUDE.md updates (REQ-env-contract).

- **File-level inventory** (from the SPEC, locked):
  - **New**: `lib/topics.ts`, `lib/api/sentiment.ts`, `lib/api/alerts.ts`, `lib/cache/timeseries.ts`, `app/api/sentiment/route.ts`, `app/api/hero/route.ts`, plus the 5 Vitest test files, `vitest.config.ts`.
  - **Extended**: `lib/types.ts`, `lib/constants.ts`, `lib/api/trending.ts`, `app/api/cron/refresh/route.ts`, `lib/hooks/use-dashboard.ts`, `components/widgets/SentimentWidget.tsx`, `components/widgets/HeroStoryCard.tsx`, `components/DashboardShell.tsx`, `.env.example`, `CLAUDE.md`, `package.json`.

- **Concrete acceptance signals** (must be checkable):
  - `curl /api/sentiment` returns `{positive, neutral, negative, sampleSize}`; three percentages sum to 100.
  - `curl /api/hero` returns a valid `HeroStory` or 503.
  - `redis-cli LLEN alerts:spikes` ≤ 100.
  - `npm run build && npm run lint` clean.
  - `npm test` exits 0; the 5 test files all run.
  - `grep -r HUGGINGFACE .env.example CLAUDE.md` is empty.

</specifics>

<deferred>
## Deferred Ideas

Explicitly out of scope for Phase 1 — recorded in `.planning/STATE.md`:

| Item | Status |
|------|--------|
| Spike-alert consumers (toast/email/Slack) | Deferred to v2 |
| Sentiment history / sparkline view | Deferred to v2 |
| Multi-provider fallback chain (Together → Replicate, etc.) | Deferred to v2 |
| `/api/sentiment` stale fallback | Deferred to v2 |
| Per-platform sentiment breakdown | Deferred to v2 |
| Per-topic sentiment breakdown | Deferred to v2 |

</deferred>

---

*Phase: 01-scrum-38-implementation*
*Context gathered: 2026-05-11 via PRD Express Path (arch/precious-leaping-wren.md)*
