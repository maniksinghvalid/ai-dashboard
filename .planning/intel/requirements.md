# Requirements

Derived from `arch/precious-leaping-wren.md` — the "What it delivers" list,
the "Scope & Architecture" file plan, and the "Verification" acceptance steps.
All requirements share source: `arch/precious-leaping-wren.md`.

---

## REQ-sentiment-engine

- **Source**: arch/precious-leaping-wren.md (Context > What it delivers, item 1)
- **Description**: Build a Sentiment Analysis Engine that batches tweets + Reddit titles each refresh cycle, runs them through `cardiffnlp/twitter-roberta-base-sentiment-latest` via Together AI (per D7), aggregates pos/neu/neg %, and exposes them at `GET /api/sentiment`.
- **Acceptance**:
  - `GET /api/sentiment` returns `{positive, neutral, negative, sampleSize}` with the three percentage fields summing to 100.
  - Cold-miss returns 503 (no stale fallback; mirrors `/api/trending` pattern).
  - Sentiment refresh leg completes within a **5s budget** per refresh cycle (measured under `/benchmark`).
  - Text inputs are preprocessed per the cardiffnlp model card (F2): `@username` → `@user`, `http*` URLs → `http`.
  - A daily char-budget circuit breaker (`SENTIMENT_DAILY_CHAR_BUDGET`, default ~200k) prevents quota overrun (D1, F1).
- **Scope**: `lib/api/sentiment.ts`, `app/api/sentiment/route.ts`, `lib/types.ts` (`Sentiment` type), `lib/constants.ts` (`CACHE_KEYS.sentiment` 15-min TTL).

## REQ-trending-velocity

- **Source**: arch/precious-leaping-wren.md (Context > What it delivers, item 2; Scope & Architecture > `lib/api/trending.ts`)
- **Description**: Replace the current "count + log2 score" heuristic in `lib/api/trending.ts` with a true velocity calc: `(count_now − count_1h_ago) / 1h`. Source topics from a typed taxonomy. Cache ranked output at `trending:ranked` with a 10-min TTL.
- **Acceptance**:
  - Velocity computed via `zrangeWindow(now-3600, now)` minus `zrangeWindow(now-7200, now-3600)` against the unified ZSET (D2).
  - Topics ranked by velocity.
  - `GET /api/trending` continues to work (no breaking change to response shape beyond ranking source).
- **Scope**: `lib/api/trending.ts`, `lib/topics.ts` (new), `lib/cache/timeseries.ts` (new).

## REQ-topic-taxonomy

- **Source**: arch/precious-leaping-wren.md (Scope & Architecture > Files — new > `lib/topics.ts`; D5)
- **Description**: Central typed AI topic taxonomy with aliases and optional word-boundary matching. Replaces the inline `AI_TERMS` array in `lib/api/trending.ts`.
- **Acceptance**:
  - Exports `AI_TOPICS: Topic[]` where `type Topic = { id: string; label: string; aliases: string[]; wordBoundary?: boolean }` (D5).
  - Covers GPT-5, Claude, Gemini, ARC-AGI, agents, local LLMs (extensible).
  - `wordBoundary: true` applied to collision-prone topics like "agents".
  - Unit tested per D6.
- **Scope**: `lib/topics.ts`, `lib/api/trending.ts` (consumer migration).

## REQ-hero-auto-promotion

- **Source**: arch/precious-leaping-wren.md (Context > What it delivers, item 3; D3)
- **Description**: When a topic is top-3 on YouTube + Reddit + X simultaneously (per D3, relaxed from the ticket's literal "#1 on all 3"), fuse top video + top post + tweet count and expose at `GET /api/hero`. Cache at `hero:cross-platform`, 10-min TTL.
- **Acceptance**:
  - `GET /api/hero` returns a valid `HeroStory` when a qualifying cross-platform topic exists, ranked by aggregate velocity.
  - Returns 503 when no topic qualifies.
  - The route handler documents the top-3-on-all-3 relaxation inline (D3 requirement).
  - `HeroStoryCard` widget renders the API payload when present; falls back to existing client-side `deriveHeroStory()` otherwise (no blank card on first paint).
- **Scope**: `app/api/hero/route.ts`, `lib/types.ts` (`HeroStory` extension with `platforms` discriminator if needed), `components/widgets/HeroStoryCard.tsx`, `lib/hooks/use-dashboard.ts`.

## REQ-spike-alerts

- **Source**: arch/precious-leaping-wren.md (Context > What it delivers, item 4)
- **Description**: When a topic's velocity exceeds 500% of its 24h baseline (i.e., > 5×), append a spike event to the Redis list `alerts:spikes`. Cap the list at 100 entries via `LTRIM` on every write. No notification consumer in this scope.
- **Acceptance**:
  - `writeSpikeAlert(topic, velocity, baseline)` performs `LPUSH alerts:spikes <json>` followed by `LTRIM alerts:spikes 0 99`.
  - 24h baseline read from the unified ZSET (D2) via `lib/cache/timeseries.ts`.
  - `redis-cli LLEN alerts:spikes` ≤ 100 at all times.
  - Spike detection covered by unit tests (D6).
- **Scope**: `lib/api/alerts.ts`, `lib/cache/timeseries.ts`, `lib/api/trending.ts` (spike emit hook), `lib/constants.ts` (`CACHE_KEYS.spikes`).

## REQ-sentiment-widget-polish

- **Source**: arch/precious-leaping-wren.md (User decisions; Scope & Architecture > `components/widgets/SentimentWidget.tsx`; gate 2 `/design-html`)
- **Description**: Replace the placeholder `SentimentWidget` with a polished design driven by the new API shape `{positive, neutral, negative, sampleSize}`. Conform to the project's widget contract: accept `{data, stale, isLoading, error}` props, render via `WidgetCard`, handle all states.
- **Acceptance**:
  - No hardcoded sample data remains.
  - Live percentages render and visibly sum to 100.
  - Matches existing dark theme tokens (`--surface-2`, `--accent`, `--accent-secondary`).
  - HTML mockup committed under `arch/` (gate 2 output) before implementation.
  - Wrapped in `WidgetErrorBoundary` via `DashboardShell` (existing pattern).
- **Scope**: `components/widgets/SentimentWidget.tsx`, `arch/<sentiment-widget>.html` (gate 2 mockup), `components/DashboardShell.tsx`.

## REQ-cron-three-tier-dag

- **Source**: arch/precious-leaping-wren.md (D4; F3; Scope & Architecture > `app/api/cron/refresh/route.ts`)
- **Description**: Restructure `app/api/cron/refresh/route.ts` as a 3-tier sequenced DAG (Tier 1: external fetches ‖, Tier 2: trending tally writes ZSETs, Tier 3: hero ‖ alerts ‖ sentiment). Each tier `Promise.allSettled`. Export `maxDuration = 30`.
- **Acceptance**:
  - All three new Tier-3 legs (sentiment, hero promoter, ranked trending) wired in.
  - Failure of any leg does not block siblings (existing pattern preserved).
  - `export const maxDuration = 30` present.
  - Cron completes well under 30s under normal load (~12s expected).
- **Scope**: `app/api/cron/refresh/route.ts`.

## REQ-vitest-bootstrap

- **Source**: arch/precious-leaping-wren.md (D6; Updated file plan > Test infrastructure)
- **Description**: Bootstrap the project's first test framework. Add Vitest + coverage + `tsx`, scripts, and config. Add `npm test` to CLAUDE.md commands.
- **Acceptance**:
  - `package.json` includes `vitest`, `@vitest/coverage-v8`, `tsx` and scripts `test`, `test:watch`, `test:coverage`.
  - `vitest.config.ts` present with `environment: "node"` and `@/*` alias to project root.
  - `npm test` runs green.
  - Test files exist and pass: `lib/topics.test.ts`, `lib/api/sentiment.test.ts` (incl. `preprocessText`), `lib/api/trending.test.ts` (velocity + hero promotion threshold), `lib/api/alerts.test.ts` (spike detection), `lib/cache/timeseries.test.ts`.
  - CLAUDE.md "Commands" section updated with `npm test`.
- **Scope**: `package.json`, `vitest.config.ts`, the five test files above, `CLAUDE.md`.

## REQ-dashboard-data-wiring

- **Source**: arch/precious-leaping-wren.md (Scope & Architecture > `lib/hooks/use-dashboard.ts`, `components/DashboardShell.tsx`)
- **Description**: Wire the new sentiment + hero endpoints into the dashboard hook and shell using the existing `useApiData<T>()` SWR pattern.
- **Acceptance**:
  - `useDashboard()` returns `sentiment = useApiData<Sentiment>("/api/sentiment")` and `hero = useApiData<HeroStory>("/api/hero")` alongside existing legs.
  - `DashboardShell` passes both into the respective widgets.
  - No direct `useSWR` calls — must reuse `useApiData`.
- **Scope**: `lib/hooks/use-dashboard.ts`, `components/DashboardShell.tsx`.

## REQ-env-contract

- **Source**: arch/precious-leaping-wren.md (F1)
- **Description**: Update env contract for the new sentiment provider.
- **Acceptance**:
  - `.env.example` includes `TOGETHER_API_KEY` and `SENTIMENT_DAILY_CHAR_BUDGET` (default ~200000).
  - `HUGGINGFACE_API_TOKEN` is NOT present (explicit drop per F1).
  - CLAUDE.md "Environment Variables" section updated accordingly.
- **Scope**: `.env.example`, `CLAUDE.md`.
