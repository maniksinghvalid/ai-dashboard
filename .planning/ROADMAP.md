# Roadmap: AIP-Dash

## Overview

This roadmap covers a single GSD phase: **SCRUM-38 Implementation** — the intelligence
layer on top of the already-shipped data layer (SCRUM-36) and UI shell (SCRUM-37).
The phase ships the Sentiment Analysis Engine (Together AI), true cross-platform
velocity ranking, top-3-on-all-3 hero auto-promotion, spike alerts, the project's
first test framework (Vitest), and the supporting cron DAG / env / dashboard wiring.

Per the ingest scope ("Implementation only / gate 3"), QA, benchmark, review, ship,
land-and-deploy, and canary are gstack skill protocols — they are **not** split into
separate GSD phases. The per-task breakdown for the single phase below happens in
`/gsd-plan-phase 1`.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: SCRUM-38 Implementation** - Ship the sentiment engine, true velocity trending, cross-platform hero, spike alerts, Vitest, and the cron DAG / dashboard wiring that activates them

## Phase Details

### Phase 1: SCRUM-38 Implementation
**Goal**: Activate the dashboard's intelligence layer — users see live cross-platform AI sentiment, true velocity-ranked trending, and an auto-promoted hero story whenever a topic peaks simultaneously on YouTube, Reddit, and X — all driven by a single 3-tier cron DAG and protected by the project's first unit-test suite.
**Depends on**: SCRUM-36 (data layer, shipped) and SCRUM-37 (UI shell, shipped). No prior GSD phase.
**Requirements**: REQ-sentiment-engine, REQ-env-contract, REQ-trending-velocity, REQ-topic-taxonomy, REQ-spike-alerts, REQ-hero-auto-promotion, REQ-cron-three-tier-dag, REQ-vitest-bootstrap, REQ-sentiment-widget-polish, REQ-dashboard-data-wiring
**Success Criteria** (what must be TRUE):
  1. **Sentiment 5s budget met:** A single `/benchmark` run shows the sentiment refresh leg completing within 5s per cron cycle; `GET /api/sentiment` returns `{positive, neutral, negative, sampleSize}` with the three percentages summing to 100, cold-miss returns 503, and `SENTIMENT_DAILY_CHAR_BUDGET` trips the circuit breaker before quota overrun.
  2. **Hero promotes on top-3-on-all-3:** When a topic appears in the top 3 on YouTube **and** Reddit **and** X simultaneously, `GET /api/hero` returns a valid `HeroStory` ranked by aggregate velocity and the `HeroStoryCard` renders the API payload; when no topic qualifies, the route returns 503 and the card falls back to the existing client-side `deriveHeroStory()` (no blank card).
  3. **Trending shows true velocity (not heuristic count):** `GET /api/trending` returns topics ranked by `(count_now − count_1h_ago) / 1h` computed via `zrangeWindow` against the unified `(topic, platform)` ZSETs (D2 storage); the old "count + log2" heuristic is gone; topics come from the typed `AI_TOPICS` taxonomy in `lib/topics.ts` (D5 shape) and word-boundary collision-prone topics like "agents" match correctly.
  4. **Spike alerts emit + cap holds:** When a topic's velocity exceeds 5× its 24h baseline, an entry lands on the `alerts:spikes` Redis list; `LLEN alerts:spikes` stays ≤ 100 at all times because every `LPUSH` is followed by `LTRIM alerts:spikes 0 99`.
  5. **Sentiment widget shows live data:** The `SentimentWidget` displays the live API payload (no hardcoded sample data anywhere), the gate-2 HTML mockup is committed under `arch/`, the widget conforms to the `{data, stale, isLoading, error}` props contract, and `DashboardShell` wraps it in `WidgetErrorBoundary`.
  6. **Cron DAG runs the 3 tiers under 30s:** `app/api/cron/refresh/route.ts` exports `maxDuration = 30`, executes Tier 1 → Tier 2 → Tier 3 sequentially with `Promise.allSettled` per tier, and a single failed leg does not block its siblings or downstream tiers where they are independent.
  7. **Tests run green:** `npm test` exits 0 with all five required unit-test files present (`lib/topics.test.ts`, `lib/api/sentiment.test.ts` covering `preprocessText`, `lib/api/trending.test.ts` covering velocity + hero threshold, `lib/api/alerts.test.ts` covering spike detection, `lib/cache/timeseries.test.ts`); `vitest.config.ts` uses `environment: "node"` and aliases `@/*` to project root; CLAUDE.md "Commands" lists `npm test`.
  8. **Env contract migrated:** `.env.example` contains `TOGETHER_API_KEY` + `SENTIMENT_DAILY_CHAR_BUDGET` (default ~200000), `HUGGINGFACE_API_TOKEN` is **absent**, and the CLAUDE.md "Environment Variables" section reflects the same.
**Plans**: TBD (see "Suggested in-phase ordering" below — `/gsd-plan-phase 1` will produce the per-plan breakdown)
**UI hint**: yes

**Suggested in-phase ordering** (from synthesis Roadmapper hints — non-binding; the planner refines):
1. Test infrastructure (D6, REQ-vitest-bootstrap) — unblocks everything else
2. Topic taxonomy (REQ-topic-taxonomy) — pure data, prerequisite for trending refactor
3. Time-series wrapper `lib/cache/timeseries.ts` — pre-req for trending + alerts
4. Trending velocity refactor (REQ-trending-velocity) — consumer of items 2-3
5. Spike alerts (REQ-spike-alerts) — consumer of item 3, hooks into item 4
6. Sentiment engine + route (REQ-sentiment-engine) — independent leg
7. Hero promoter + route (REQ-hero-auto-promotion) — consumer of items 2-4
8. Cron 3-tier DAG (REQ-cron-three-tier-dag) — orchestrates 4/5/6/7
9. Dashboard wiring (REQ-dashboard-data-wiring) — frontend consumes 6/7
10. Sentiment widget polish (REQ-sentiment-widget-polish) — gated on gate-2 mockup committed under `arch/`
11. Env contract + CLAUDE.md updates (REQ-env-contract)

**Fallback policy (F4 / CON-scope-trip-risk):** if friction surfaces during execution, REQ-spike-alerts and its slice of `lib/cache/timeseries.ts` split cleanly to a follow-up PR — alerts have no consumer yet, so they are cleanly separable. This is an acknowledged decision point, not a default action.

## Progress

**Execution Order:**
Single phase. No decimals planned.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. SCRUM-38 Implementation | 0/TBD | Not started | - |
