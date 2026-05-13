# Requirements: AIP-Dash (SCRUM-38)

All requirements are v1 (current implementation scope). All ten are derived from
`arch/precious-leaping-wren.md` — see `.planning/intel/requirements.md` for the
full source-traced detail (acceptance criteria + scope per requirement).

## Categories

- **SENTIMENT** — Sentiment Analysis Engine + provider contract (2 requirements)
- **TRENDING** — True velocity ranking + topic taxonomy + spike alerts (3 requirements)
- **HERO** — Cross-platform hero auto-promotion (1 requirement)
- **CRON** — 3-tier DAG orchestrator (1 requirement)
- **TEST** — First-time Vitest bootstrap (1 requirement)
- **UI** — Sentiment widget polish + dashboard data wiring (2 requirements)

Total: 6 categories, 10 requirements.

## Requirements

### SENTIMENT

#### REQ-sentiment-engine
- **Description:** Build a Sentiment Analysis Engine that batches tweets + Reddit titles each refresh cycle, runs them through Together AI (per D7 / **D8 amendment 2026-05-13**: `meta-llama/Llama-3.3-70B-Instruct-Turbo` LLM-as-judge classifier instead of `cardiffnlp/twitter-roberta-base-sentiment-latest`), aggregates pos/neu/neg %, and exposes them at `GET /api/sentiment`.
- **Acceptance:**
  - `GET /api/sentiment` returns `{positive, neutral, negative, sampleSize}` with the three percentage fields summing to 100.
  - Cold-miss returns 503 (no stale fallback; mirrors `/api/trending` pattern).
  - ~~Sentiment refresh leg completes within a **5s budget** per refresh cycle (measured under `/benchmark`).~~ **Superseded by D8/D9 (2026-05-13):** sentiment leg under D8 uses `TIMEOUT_MS = 35_000`; cron `maxDuration` is 60 (D9). 5s budget is not an acceptance criterion anymore.
  - Text inputs preprocessed via F2: `@username` → `@user`, `http*` URLs → `http`. Originally a cardiffnlp model-card requirement; under D8 retained for LLM token-bloat reduction.
  - Daily char-budget circuit breaker (`SENTIMENT_DAILY_CHAR_BUDGET`, default ~200k) prevents quota overrun (D1, F1).
- **Scope:** `lib/api/sentiment.ts`, `app/api/sentiment/route.ts`, `lib/types.ts` (`Sentiment` type), `lib/constants.ts` (`CACHE_KEYS.sentiment` 15-min TTL).
- **Source:** `arch/precious-leaping-wren.md` (Context > What it delivers, item 1)

#### REQ-env-contract
- **Description:** Update env contract for the new sentiment provider.
- **Acceptance:**
  - `.env.example` includes `TOGETHER_API_KEY` and `SENTIMENT_DAILY_CHAR_BUDGET` (default ~200000).
  - `HUGGINGFACE_API_TOKEN` is NOT present (explicit drop per F1).
  - CLAUDE.md "Environment Variables" section updated accordingly.
- **Scope:** `.env.example`, `CLAUDE.md`.
- **Source:** `arch/precious-leaping-wren.md` (F1)

### TRENDING

#### REQ-trending-velocity
- **Description:** Replace the current "count + log2 score" heuristic in `lib/api/trending.ts` with a true velocity calc: `(count_now − count_1h_ago) / 1h`. Source topics from the typed taxonomy. Cache ranked output at `trending:ranked` with a 10-min TTL.
- **Acceptance:**
  - Velocity computed via `zrangeWindow(now-3600, now)` minus `zrangeWindow(now-7200, now-3600)` against the unified ZSET (D2).
  - Topics ranked by velocity.
  - `GET /api/trending` continues to work (no breaking change to response shape beyond ranking source).
- **Scope:** `lib/api/trending.ts`, `lib/topics.ts` (new), `lib/cache/timeseries.ts` (new).
- **Source:** `arch/precious-leaping-wren.md` (Context > What it delivers, item 2)

#### REQ-topic-taxonomy
- **Description:** Central typed AI topic taxonomy with aliases and optional word-boundary matching. Replaces the inline `AI_TERMS` array in `lib/api/trending.ts`.
- **Acceptance:**
  - Exports `AI_TOPICS: Topic[]` where `type Topic = { id: string; label: string; aliases: string[]; wordBoundary?: boolean }` (D5).
  - Covers GPT-5, Claude, Gemini, ARC-AGI, agents, local LLMs (extensible).
  - `wordBoundary: true` applied to collision-prone topics like "agents".
  - Unit-tested per D6.
- **Scope:** `lib/topics.ts`, `lib/api/trending.ts` (consumer migration).
- **Source:** `arch/precious-leaping-wren.md` (Scope & Architecture > new files; D5)

#### REQ-spike-alerts
- **Description:** When a topic's velocity exceeds 500% of its 24h baseline (i.e., > 5×), append a spike event to the Redis list `alerts:spikes`. Cap the list at 100 entries via `LTRIM` on every write. No notification consumer in this scope.
- **Acceptance:**
  - `writeSpikeAlert(topic, velocity, baseline)` performs `LPUSH alerts:spikes <json>` followed by `LTRIM alerts:spikes 0 99`.
  - 24h baseline read from the unified ZSET (D2) via `lib/cache/timeseries.ts`.
  - `redis-cli LLEN alerts:spikes` ≤ 100 at all times.
  - Spike detection covered by unit tests (D6).
- **Scope:** `lib/api/alerts.ts`, `lib/cache/timeseries.ts`, `lib/api/trending.ts` (spike emit hook), `lib/constants.ts` (`CACHE_KEYS.spikes`).
- **Source:** `arch/precious-leaping-wren.md` (Context > What it delivers, item 4)

### HERO

#### REQ-hero-auto-promotion
- **Description:** When a topic is top-3 on YouTube + Reddit + X simultaneously (per D3, relaxed from the ticket's literal "#1 on all 3"), fuse top video + top post + tweet count and expose at `GET /api/hero`. Cache at `hero:cross-platform`, 10-min TTL.
- **Acceptance:**
  - `GET /api/hero` returns a valid `HeroStory` when a qualifying cross-platform topic exists, ranked by aggregate velocity.
  - Returns 503 when no topic qualifies.
  - The route handler documents the top-3-on-all-3 relaxation inline (D3 requirement).
  - `HeroStoryCard` widget renders the API payload when present; falls back to existing client-side `deriveHeroStory()` otherwise (no blank card on first paint).
- **Scope:** `app/api/hero/route.ts`, `lib/types.ts` (`HeroStory` extension), `components/widgets/HeroStoryCard.tsx`, `lib/hooks/use-dashboard.ts`.
- **Source:** `arch/precious-leaping-wren.md` (Context > What it delivers, item 3; D3)

### CRON

#### REQ-cron-three-tier-dag
- **Description:** Restructure `app/api/cron/refresh/route.ts` as a 3-tier sequenced DAG (Tier 1: external fetches ‖, Tier 2: trending tally writes ZSETs, Tier 3: hero ‖ alerts ‖ sentiment). Each tier `Promise.allSettled`. ~~Export `maxDuration = 30`.~~ **D9 amendment 2026-05-13:** Export `maxDuration = 60` to accommodate D8's LLM-judge sentiment leg (35s timeout).
- **Acceptance:**
  - All three new Tier-3 legs (sentiment, hero promoter, ranked trending) wired in.
  - Failure of any leg does not block siblings (existing pattern preserved).
  - ~~`export const maxDuration = 30` present.~~ Replaced by `export const maxDuration = 60` (D9).
  - ~~Cron completes well under 30s under normal load (~12s expected).~~ Superseded — under D8 the sentiment leg dominates wall-time; expected range is now 15–45s.
- **Scope:** `app/api/cron/refresh/route.ts`.
- **Source:** `arch/precious-leaping-wren.md` (D4; F3)

### TEST

#### REQ-vitest-bootstrap
- **Description:** Bootstrap the project's first test framework. Add Vitest + coverage + `tsx`, scripts, and config. Add `npm test` to CLAUDE.md commands.
- **Acceptance:**
  - `package.json` includes `vitest`, `@vitest/coverage-v8`, `tsx` and scripts `test`, `test:watch`, `test:coverage`.
  - `vitest.config.ts` present with `environment: "node"` and `@/*` alias to project root.
  - `npm test` runs green.
  - Test files exist and pass: `lib/topics.test.ts`, `lib/api/sentiment.test.ts` (incl. `preprocessText`), `lib/api/trending.test.ts` (velocity + hero promotion threshold), `lib/api/alerts.test.ts` (spike detection), `lib/cache/timeseries.test.ts`.
  - CLAUDE.md "Commands" section updated with `npm test`.
- **Scope:** `package.json`, `vitest.config.ts`, the five test files above, `CLAUDE.md`.
- **Source:** `arch/precious-leaping-wren.md` (D6)

### UI

#### REQ-sentiment-widget-polish
- **Description:** Replace the placeholder `SentimentWidget` with a polished design driven by the new API shape `{positive, neutral, negative, sampleSize}`. Conform to the project's widget contract: accept `{data, stale, isLoading, error}` props, render via `WidgetCard`, handle all states.
- **Acceptance:**
  - No hardcoded sample data remains.
  - Live percentages render and visibly sum to 100.
  - Matches existing dark theme tokens (`--surface-2`, `--accent`, `--accent-secondary`).
  - HTML mockup committed under `arch/` (gate 2 output) before implementation.
  - Wrapped in `WidgetErrorBoundary` via `DashboardShell` (existing pattern).
- **Scope:** `components/widgets/SentimentWidget.tsx`, `arch/<sentiment-widget>.html`, `components/DashboardShell.tsx`.
- **Source:** `arch/precious-leaping-wren.md` (User decisions; gate 2 `/design-html`)

#### REQ-dashboard-data-wiring
- **Description:** Wire the new sentiment + hero endpoints into the dashboard hook and shell using the existing `useApiData<T>()` SWR pattern.
- **Acceptance:**
  - `useDashboard()` returns `sentiment = useApiData<Sentiment>("/api/sentiment")` and `hero = useApiData<HeroStory>("/api/hero")` alongside existing legs.
  - `DashboardShell` passes both into the respective widgets.
  - No direct `useSWR` calls — must reuse `useApiData`.
- **Scope:** `lib/hooks/use-dashboard.ts`, `components/DashboardShell.tsx`.
- **Source:** `arch/precious-leaping-wren.md` (Scope & Architecture > `lib/hooks/use-dashboard.ts`)

## Traceability

All 10 v1 requirements map to **Phase 1: SCRUM-38 Implementation** (single phase per
ingest scope — gate 3 only). See `.planning/ROADMAP.md` for phase detail and success
criteria.

| Requirement | Category | Phase | Status |
|-------------|----------|-------|--------|
| REQ-sentiment-engine | SENTIMENT | Phase 1 | Pending |
| REQ-env-contract | SENTIMENT | Phase 1 | Pending |
| REQ-trending-velocity | TRENDING | Phase 1 | Pending |
| REQ-topic-taxonomy | TRENDING | Phase 1 | Pending |
| REQ-spike-alerts | TRENDING | Phase 1 | Pending |
| REQ-hero-auto-promotion | HERO | Phase 1 | Pending |
| REQ-cron-three-tier-dag | CRON | Phase 1 | Pending |
| REQ-vitest-bootstrap | TEST | Phase 1 | Pending |
| REQ-sentiment-widget-polish | UI | Phase 1 | Pending |
| REQ-dashboard-data-wiring | UI | Phase 1 | Pending |

**Coverage:** 10 / 10 requirements mapped. No orphans. No duplicates.

## v2 (deferred / out of scope here)

- Spike-alert **consumers** (toast, email, Slack) — alerts currently produce events
  only; no UI/notification surface. Per F4 mitigation policy, alerts could split to
  a follow-up PR; either way, consumers are explicitly v2.
- Sentiment **history** view (sparkline over hours/days) — Phase 1 ships the live
  snapshot only.
- Provider **fallback chain** (e.g., Together → Replicate) — Phase 1 is single-vendor
  per D7; rotation observability (CON-key-rotation-observability) is the v1 stopgap.
- `/api/sentiment` **stale fallback** — Phase 1 mirrors `/api/trending` (cold-miss
  503); a stale-tolerant path is a separate decision.
