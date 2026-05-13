# Project: AIP-Dash

## Core Value

AIP-Dash (AI Pulse Live Dashboard) is a real-time AI industry intelligence dashboard
that aggregates YouTube, Reddit, X/Twitter, and news data, computes true cross-platform
velocity + sentiment + spike alerts, and surfaces a hero story when the same AI topic
trends on all 3 platforms simultaneously. The current GSD scope (SCRUM-38) layers
the **intelligence** on top of the already-shipped data layer (SCRUM-36) and UI shell
(SCRUM-37): paid sentiment via Together AI, velocity-based trending, cross-platform
hero auto-promotion, spike alerts, and the project's first test infrastructure.

**Success metric:** Sentiment refresh leg completes within a 5s budget per cron cycle
**AND** the hero promotes when a topic appears in top-3 on all 3 platforms
(YouTube + Reddit + X) simultaneously.

## Target Runtime

- **Platform:** Vercel (Next.js 14 App Router) on Node.js 20
- **Storage:** Upstash Redis (caching + time-series ZSETs); no SQL store
- **Refresh cadence:** Vercel daily cron (`/api/cron/refresh` GET, bearer-auth via `CRON_SECRET`) + Upstash QStash 15-min POST (signed) — both hit the same handler
- **Inference:** Together AI (sentiment) hosting `cardiffnlp/twitter-roberta-base-sentiment-latest`
- **Instrumentation:** Sentry (client + server + edge), all guarded by `NEXT_PUBLIC_SENTRY_DSN` presence
- **UI:** Dark-only theme (`<html className="dark">`), DM Sans + Space Mono, Tailwind with custom token overrides (see CLAUDE.md)

## Constraints

- **Vercel function ceiling:** `app/api/cron/refresh/route.ts` must `export const maxDuration = 30`. Default 10s ceiling would time out the 3-tier DAG (Tier 1 ~3-5s + Tier 2 ~1-2s + Tier 3 ~2-5s ≈ ~12s).
- **Sentiment budget:** 5s per refresh cycle (provider choice was budget-driven). If Together latency drifts, provider is re-evaluated; the budget does not relax.
- **Sentiment quota:** `SENTIMENT_DAILY_CHAR_BUDGET` (default ~200000) is a hard circuit breaker. Original ~57M chars/month projection at 15-min cadence × 100 texts × ~200 chars is the ceiling being protected against.
- **Trending storage:** One Redis ZSET per `(topic, platform)`, 96-slot cap, time-scored. **Forbidden:** snapshot rotation, `trending:snapshot:1h` keys. Both `trending.ts` and `alerts.ts` read this shape via `lib/cache/timeseries.ts`.
- **Alerts cap:** `alerts:spikes` Redis list capped at 100 entries; every `LPUSH` followed by `LTRIM alerts:spikes 0 99` in the same call sequence.
- **Hero threshold:** Top-3 on all 3 platforms (relaxation from ticket's literal "#1 on all 3") — must be documented inline in `app/api/hero/route.ts`.
- **Cron DAG shape:** 3 sequenced tiers, each `Promise.allSettled`. Tier 1 external fetches ‖, Tier 2 trending tally writes ZSETs, Tier 3 hero ‖ alerts ‖ sentiment.
- **Redis client:** Always `getRedis()` (lazy init) — never `new Redis()` directly. Lazy pattern is required because Upstash validates URLs at construction time and breaks `next build` when env vars are absent.
- **SWR access:** New dashboard data hooks must use `useApiData<T>()` from `lib/hooks/use-api-data.ts` — no direct `useSWR` calls.
- **Cardiffnlp preprocessing:** Inputs must be normalized (`@username` → `@user`, `http*` URL → `http`) before being sent to the model. Skipping is a silent quality regression and is forbidden.
- **PR shape risk:** 14 files / 5 new modules trips both complexity triggers (≥8 files AND ≥2 new modules). Alerts (`lib/api/alerts.ts` + its slice of `timeseries.ts` + spike thresholds) are cleanly separable to a follow-up PR if friction surfaces.
- **Env contract drop:** `HUGGINGFACE_API_TOKEN` is **explicitly forbidden** — never reintroduce.
- **Key rotation observability:** Sentry should surface 401s from the sentiment fetch leg; the client should log 401s explicitly rather than swallowing them.

## Historical Milestones (Shipped — do not plan)

| Ticket | Title | Status | Notes |
|--------|-------|--------|-------|
| SCRUM-36 | Data layer (API clients, Redis caching, cron skeleton) | done | Provides `lib/api/{youtube,reddit,twitter,news,trending}.ts`, `lib/cache/{redis,helpers}.ts`, cron route stub. SCRUM-38 depends on this. |
| SCRUM-37 | Frontend dashboard UI (shell, widget contracts, theme) | done | Provides `DashboardShell`, `WidgetCard`, `WidgetErrorBoundary`, `HeroStoryCard`, placeholder `SentimentWidget`, dark theme tokens. SCRUM-38 polishes SentimentWidget + HeroStoryCard but does not rebuild the shell. |

Current SCRUM-38 work assumes both predecessors are merged and in production. The
roadmap below does not plan work for them.

## Active Scope

- **Epic:** SCRUM-27 (AIP-Dash)
- **Active ticket:** [SCRUM-38](https://prabhneet.atlassian.net/browse/SCRUM-38) — Sentiment Analysis Engine & Cross-Platform Trending
- **Maps to:** Phase 1 of this roadmap (single phase, see ROADMAP.md)
- **Out of scope here:** gstack post-implementation gates 4–9 (`/qa`, `/benchmark`, `/review`, `/ship`, `/land-and-deploy`, `/canary`) are gstack skill protocols, not GSD phases.

## Key Decisions

<decisions>

All entries below are **LOCKED**. Source: `arch/precious-leaping-wren.md` (embedded GSTACK REVIEW REPORT). The roadmapper / planner must not soften, re-debate, or restructure these.

| ID | Status | Decision | Rationale (short) |
|----|--------|----------|-------------------|
| D1 | locked | Use a paid inference vendor with a daily char-budget circuit breaker; drop HF Serverless entirely | HF free tier is 30k chars/month vs ~57M chars/month projected usage at 15-min cadence × 100 texts × ~200 chars |
| D2 | locked | One Redis ZSET per `(topic, platform)`, 96-slot cap, time-scored; no snapshot rotation; single structure feeds 1h velocity calc and 24h alert baseline | Eliminates the `trending:snapshot:1h` rotation race condition flagged as risk #2 in the original plan |
| D3 | locked | Hero promotes when a topic is top-3 on all 3 platforms, ranked by aggregate velocity; route handler must document this relaxation from the ticket's literal "#1 on all 3" wording | Sparse X data means strict "#1 on all 3" rarely fires; top-3 keeps the feature active while preserving cross-platform signal |
| D4 | locked | Cron is a 3-tier sequenced DAG with `Promise.allSettled` per tier: Tier 1 external fetches ‖, Tier 2 trending tally writes ZSETs, Tier 3 hero ‖ alerts ‖ sentiment | Any leg's failure does not block siblings or downstream tiers where siblings are independent |
| D5 | locked | `lib/topics.ts` shape: `type Topic = { id: string; label: string; aliases: string[]; wordBoundary?: boolean }` — substring matching by default, `wordBoundary: true` for collision-prone topics like "agents" | Typed taxonomy replaces inline `AI_TERMS` array; needed for unit testability |
| D6 | locked | Vitest is the test framework. Test the pure-function core only: `lib/topics.ts`, velocity calc, hero threshold, sentiment aggregation, alert spike detection, cardiffnlp preprocessing. Skip route handlers. 5 test files required; deps `vitest` + `@vitest/coverage-v8` + `tsx`; scripts `test` / `test:watch` / `test:coverage`; `vitest.config.ts` with `environment: "node"` and `@/*` alias to project root | Project's first test framework; bootstraps pure-function coverage without route plumbing |
| D7 | **amended 2026-05-13 — see D8** | ~~Together AI is the sentiment provider, hosting `cardiffnlp/twitter-roberta-base-sentiment-latest`; new env var `TOGETHER_API_KEY`~~ | Together's fast batch endpoint meets the 5s budget natively |
| D8 | locked (amends D7) | Together AI is still the sentiment provider with `TOGETHER_API_KEY`, but the model is `meta-llama/Llama-3.3-70B-Instruct-Turbo` via the chat-completions endpoint (LLM-as-judge classifier), not the cardiffnlp fine-tuned classifier. Output is parsed from a JSON-shaped chat response into `{label, score}` per input via `parseTogetherClassificationResponse` (`lib/api/sentiment.ts`). | At execution time, Together's batch classification endpoint for the cardiffnlp model was not in a viable shape for this workload; the LLM-judge approach via Llama-3.3-70B-Instruct-Turbo was chosen as a pragmatic substitution. F2 preprocessing remains useful — `@user` and `http` normalization reduces token bloat and input noise for any classifier, including the LLM-judge variant. Trade-off: the original D7-cited 5s budget premise no longer holds (see D9 amending F3). |
| F1 | locked | `.env.example`: add `TOGETHER_API_KEY` + `SENTIMENT_DAILY_CHAR_BUDGET` (default ~200000); **drop** `HUGGINGFACE_API_TOKEN` (never to be introduced) | Aligns env contract with D7+D8 + D1 |
| F2 | locked (still applicable post-D8) | `lib/api/sentiment.ts` ships `preprocessText()` replacing `@username` → literal `@user` and any `http*` URL → literal `http` before submitting to the model; unit-tested per D6 | Originally cardiffnlp model-card requirement; under D8 the normalization is retained because it reduces LLM token bloat and improves classification stability |
| F3 | **amended 2026-05-13 — see D9** | ~~`app/api/cron/refresh/route.ts` exports `const maxDuration = 30`~~ | 3-tier DAG hits ~12s under load; Vercel default 10s would time out |
| D9 | locked (amends F3) | `app/api/cron/refresh/route.ts` exports `const maxDuration = 60` (not 30). Sentiment leg under D8 uses `TIMEOUT_MS = 35_000` for the Llama-3.3-70B chat-completion call, which structurally cannot fit inside a 30s function ceiling. Acceptable because the cron path is async (QStash POST or daily GET) and not in any user-facing latency path. | F3's 30s ceiling was sized for the cardiffnlp batch endpoint; D8's LLM-judge substitution invalidates that sizing. Trade-off: doubled wall-time ceiling; Vercel function cost is per-active-CPU-time so idle wait inside the 35s sentiment timeout is cheap; net function billing impact is minor. The original "DAG hits ~12s under load" rationale is also obsolete — the LLM-judge path runs longer. |
| F4 | locked (as risk + mitigation policy) | PR trips both complexity triggers (14 files / 5 new modules ≥ 8 files AND ≥ 2 new modules). User pre-committed to bundle alerts. Mitigation: if friction surfaces during implementation, alerts (`lib/api/alerts.ts`, alerts ZSET reads, spike thresholds) split cleanly to a follow-up PR — alerts have no consumer yet | Acknowledged scope-trip risk with a known-good fallback shape |

</decisions>

## Pointers

- Synthesis entry point: `.planning/intel/SYNTHESIS.md`
- Decisions detail: `.planning/intel/decisions.md`
- Requirements detail: `.planning/intel/requirements.md`
- Constraints detail: `.planning/intel/constraints.md`
- Context detail: `.planning/intel/context.md`
- Source spec: `arch/precious-leaping-wren.md`
- Roadmap: `.planning/ROADMAP.md`
- State: `.planning/STATE.md`
- Project conventions: `CLAUDE.md` (repo root)
