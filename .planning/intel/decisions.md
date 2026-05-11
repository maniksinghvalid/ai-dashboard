# Decisions

Synthesized from `/plan-eng-review` GSTACK REVIEW REPORT embedded in the SPEC.
All entries are treated as LOCKED — manifest pinned the doc as authoritative and
the review report explicitly "locks in" each row.

---

## D1 — HF inference path

- **Source**: arch/precious-leaping-wren.md (GSTACK REVIEW REPORT > Lock-in decisions, row D1)
- **Status**: locked
- **Scope**: sentiment inference vendor
- **Decision**: Use a paid inference vendor with a daily char-budget circuit breaker. Drop HF Serverless entirely.
- **Rationale**: HF free tier is 30k chars/month; projected usage ~57M chars/month at 15-min cadence × 100 texts × ~200 chars makes the free tier non-viable.

## D2 — Time-series storage

- **Source**: arch/precious-leaping-wren.md (GSTACK REVIEW REPORT > Lock-in decisions, row D2)
- **Status**: locked
- **Scope**: trending velocity + spike alert baseline storage
- **Decision**: One Redis ZSET per `(topic, platform)` with a 96-slot cap, time-scored. Single structure feeds both the 1h velocity calc and the 24h alert baseline. No snapshot rotation.
- **Rationale**: Eliminates the `trending:snapshot:1h` rotation race condition flagged as risk #2 in the original plan.

## D3 — Hero cross-platform threshold

- **Source**: arch/precious-leaping-wren.md (GSTACK REVIEW REPORT > Lock-in decisions, row D3)
- **Status**: locked
- **Scope**: hero auto-promotion eligibility
- **Decision**: Promote when a topic is **top-3 on all 3 platforms**, ranked by aggregate velocity. The route handler must document this relaxation from the ticket's literal "#1 on all 3" wording.
- **Rationale**: Sparse X data means strict "#1 on all 3" rarely fires; top-3 keeps the feature active while preserving cross-platform signal.

## D4 — Cron orchestration

- **Source**: arch/precious-leaping-wren.md (GSTACK REVIEW REPORT > Lock-in decisions, row D4)
- **Status**: locked
- **Scope**: `app/api/cron/refresh/route.ts` execution shape
- **Decision**: Three-tier sequenced DAG:
  - **Tier 1**: external fetches (YouTube/Reddit/X/news) in parallel.
  - **Tier 2**: trending tally writes ZSETs (depends on Tier 1).
  - **Tier 3**: hero promoter ‖ alerts ‖ sentiment, all in parallel (depend on Tier 2).
- Each tier wrapped in `Promise.allSettled` so any leg's failure does not block siblings or downstream tiers (where siblings are independent).

## D5 — `lib/topics.ts` shape

- **Source**: arch/precious-leaping-wren.md (GSTACK REVIEW REPORT > Lock-in decisions, row D5)
- **Status**: locked
- **Scope**: AI topic taxonomy data model
- **Decision**: Typed objects with aliases and optional `wordBoundary` flag:
  ```ts
  type Topic = { id: string; label: string; aliases: string[]; wordBoundary?: boolean }
  ```
  Substring matching by default; `wordBoundary: true` for collision-prone topics like "agents".

## D6 — Tests

- **Source**: arch/precious-leaping-wren.md (GSTACK REVIEW REPORT > Lock-in decisions, row D6)
- **Status**: locked
- **Scope**: test infrastructure bootstrap
- **Decision**: Add **Vitest** now. Test the pure-function core (`lib/topics.ts`, velocity calc, hero promotion threshold, sentiment aggregation, alert spike detection, cardiffnlp preprocessing). Skip route handlers.
- **Test files required**: `lib/topics.test.ts`, `lib/api/sentiment.test.ts`, `lib/api/trending.test.ts`, `lib/api/alerts.test.ts`, `lib/cache/timeseries.test.ts`.
- **Package additions**: `vitest`, `@vitest/coverage-v8`, `tsx`; scripts `test` / `test:watch` / `test:coverage`.
- **Config**: `vitest.config.ts` with `environment: "node"`, alias `@/*` to project root.

## D7 — Sentiment provider

- **Source**: arch/precious-leaping-wren.md (GSTACK REVIEW REPORT > Lock-in decisions, row D7)
- **Status**: locked
- **Scope**: sentiment inference vendor identity
- **Decision**: **Together AI** hosting `cardiffnlp/twitter-roberta-base-sentiment-latest`. New env var `TOGETHER_API_KEY`. Together's fast batch endpoint meets the 5s budget natively.

---

## Fix-It F1 — Env var replacement

- **Source**: arch/precious-leaping-wren.md (GSTACK REVIEW REPORT > Fix-its applied, item 1)
- **Status**: locked
- **Scope**: `.env.example` and runtime env contract
- **Decision**: Add `TOGETHER_API_KEY` and `SENTIMENT_DAILY_CHAR_BUDGET` (default ~200000). **Drop** the originally planned `HUGGINGFACE_API_TOKEN` — it is never to be introduced.

## Fix-It F2 — Cardiffnlp preprocessing

- **Source**: arch/precious-leaping-wren.md (GSTACK REVIEW REPORT > Fix-its applied, item 2)
- **Status**: locked
- **Scope**: `lib/api/sentiment.ts` text normalization
- **Decision**: Ship `preprocessText()` that replaces `@username` with literal `@user` and any `http*` URL with literal `http` before submitting to the model. Required by the cardiffnlp model card; skipping it is a silent quality regression. Must be covered by unit tests (D6).

## Fix-It F3 — Vercel `maxDuration`

- **Source**: arch/precious-leaping-wren.md (GSTACK REVIEW REPORT > Fix-its applied, item 3)
- **Status**: locked
- **Scope**: `app/api/cron/refresh/route.ts`
- **Decision**: `export const maxDuration = 30`. The 3-tier DAG hits ~12s under load (~3-5s Tier 1 + ~1-2s Tier 2 + ~2-5s Tier 3); Vercel's default 10s is too tight.

## Fix-It F4 — Scope risk recorded

- **Source**: arch/precious-leaping-wren.md (GSTACK REVIEW REPORT > Fix-its applied, item 4)
- **Status**: locked (as an acknowledged risk + mitigation policy)
- **Scope**: PR shape / phase planning
- **Decision**: 14 files / 5 new modules trips both complexity triggers (≥8 files AND ≥2 new modules). User pre-committed to bundle alerts. **Mitigation**: if friction surfaces during implementation, split alerts (`lib/api/alerts.ts`, alerts ZSET reads, spike thresholds) to a follow-up PR — alerts have no consumer yet so they're cleanly separable.
