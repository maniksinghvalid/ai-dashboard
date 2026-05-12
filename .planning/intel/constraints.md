# Constraints

Technical constraints, NFRs, and API contracts extracted from the SPEC.
Source: `arch/precious-leaping-wren.md` for all entries.

---

## CON-hf-quota-budget (nfr)

- **Source**: arch/precious-leaping-wren.md (Risk notes #1 + Fix-its #1 + D1)
- **Type**: nfr
- **Constraint**: External LLM inference is bound by a hard daily char budget. `SENTIMENT_DAILY_CHAR_BUDGET` env var (default ~200000) gates each refresh call; once tripped, the sentiment fetch leg short-circuits for the day. The original projection (~57M chars/month at 15-min cadence × 100 texts × ~200 chars) is the ceiling we are protecting against.
- **Implication**: `lib/api/sentiment.ts` must implement the circuit breaker; it is not optional.

## CON-vercel-max-duration (nfr)

- **Source**: arch/precious-leaping-wren.md (Fix-its #3)
- **Type**: nfr
- **Constraint**: `app/api/cron/refresh/route.ts` must `export const maxDuration = 30`. The default 10s ceiling will time out the 3-tier DAG under load (Tier 1 ~3-5s + Tier 2 ~1-2s + Tier 3 ~2-5s ≈ ~12s).
- **Implication**: Vercel project plan must permit a 30s function duration. If a future plan downgrade lowers the ceiling, this fails closed.

## CON-alerts-spikes-cap (nfr)

- **Source**: arch/precious-leaping-wren.md (Risk notes #3 + Scope & Architecture > `lib/api/alerts.ts`)
- **Type**: nfr
- **Constraint**: The Redis list `alerts:spikes` must be capped at 100 entries. Every `LPUSH` to `alerts:spikes` must be followed by `LTRIM alerts:spikes 0 99` in the same call sequence.
- **Implication**: Forbids any other writer to `alerts:spikes` that does not enforce the same cap.

## CON-cardiffnlp-preprocessing (api-contract)

- **Source**: arch/precious-leaping-wren.md (Fix-its #2)
- **Type**: api-contract
- **Constraint**: Inputs to `cardiffnlp/twitter-roberta-base-sentiment-latest` must be preprocessed per the model card: `@username` → literal `@user`; any `http*` URL → literal `http`. Skipping preprocessing is a silent quality regression (the model was trained on preprocessed text).
- **Implication**: `lib/api/sentiment.ts` ships `preprocessText()`; D6 requires it under test.

## CON-sentiment-5s-budget (nfr)

- **Source**: arch/precious-leaping-wren.md (Verification step 5; D7; gstack workflow step 5 `/benchmark`)
- **Type**: nfr
- **Constraint**: The sentiment refresh leg must complete within **5 seconds** per cycle. This is an explicit acceptance criterion measured under `/benchmark`. Provider selection (D7 → Together AI) was driven by this budget.
- **Implication**: If Together's latency drifts, provider must be re-evaluated; the 5s budget does not relax.

## CON-trending-storage-shape (schema)

- **Source**: arch/precious-leaping-wren.md (D2; Updated file plan)
- **Type**: schema
- **Constraint**: Trending velocity + 24h baseline storage is a single Redis structure: one ZSET per `(topic, platform)`, time-scored, capped at 96 slots. No snapshot rotation, no `trending:snapshot:1h` key. Both `lib/api/trending.ts` and `lib/api/alerts.ts` read this same ZSET via the `lib/cache/timeseries.ts` wrapper.
- **Implication**: Forbids reintroduction of the snapshot rotation pattern from the original plan.

## CON-timeseries-api (api-contract)

- **Source**: arch/precious-leaping-wren.md (Updated file plan > New files > `lib/cache/timeseries.ts`)
- **Type**: api-contract
- **Constraint**: `lib/cache/timeseries.ts` must expose exactly: `zaddTimepoint(key, ts, count)`, `zrangeWindow(key, fromTs, toTs)`, `capToSlots(key, maxEntries)`. Used by `trending.ts` (write per cron tick) and `alerts.ts` (read 24h baseline).
- **Implication**: Both consumers go through this wrapper. No direct `getRedis().zadd()` calls scattered across modules.

## CON-hero-relaxation-disclosure (api-contract)

- **Source**: arch/precious-leaping-wren.md (D3)
- **Type**: api-contract
- **Constraint**: `app/api/hero/route.ts` must document inline that the eligibility threshold is "top-3 on all 3 platforms, ranked by aggregate velocity" — a deliberate relaxation from the SCRUM-38 ticket's literal "#1 on all 3" wording.
- **Implication**: Future readers must not silently re-tighten the threshold without revisiting D3.

## CON-cron-dag-tiers (api-contract)

- **Source**: arch/precious-leaping-wren.md (D4)
- **Type**: api-contract
- **Constraint**: Cron refresh must execute in three sequenced tiers, each wrapped in `Promise.allSettled`:
  - **Tier 1**: external fetches (YouTube, Reddit, X, news) — parallel.
  - **Tier 2**: trending tally writes ZSETs — depends on Tier 1.
  - **Tier 3**: hero promoter ‖ alerts ‖ sentiment — depend on Tier 2, parallel to each other.
- **Implication**: Reorderings (e.g., running sentiment in Tier 1) violate the locked DAG.

## CON-redis-client (api-contract)

- **Source**: arch/precious-leaping-wren.md (Patterns to reuse) + project CLAUDE.md
- **Type**: api-contract
- **Constraint**: Always use `getRedis()` from `lib/cache/redis.ts`; never instantiate `new Redis()` directly. The lazy-init pattern is required because Upstash validates URLs at construction time, which breaks `next build` when env vars are absent.
- **Implication**: New modules (`lib/api/sentiment.ts`, `lib/api/alerts.ts`, `lib/cache/timeseries.ts`) must access Redis only via `getRedis()`.

## CON-swr-wrapper (api-contract)

- **Source**: arch/precious-leaping-wren.md (Patterns to reuse) + project CLAUDE.md
- **Type**: api-contract
- **Constraint**: New dashboard data hooks (sentiment, hero) must use `useApiData<T>()` from `lib/hooks/use-api-data.ts`. Do not call `useSWR` directly.

## CON-scope-trip-risk (nfr)

- **Source**: arch/precious-leaping-wren.md (Fix-its #4)
- **Type**: nfr
- **Constraint**: This PR trips both project complexity triggers (≥8 files AND ≥2 new modules — actual: 14 files / 5 new modules). User pre-committed to bundle alerts. **Mitigation policy**: if friction surfaces during implementation, alerts (`lib/api/alerts.ts`, alerts ZSET reads, spike thresholds) split cleanly into a follow-up PR — they have no consumer yet.
- **Implication**: Roadmapper should consider an explicit "alerts split fallback" branch point in the phase plan.

## CON-key-rotation-observability (nfr)

- **Source**: arch/precious-leaping-wren.md (Risk notes updated #5)
- **Type**: nfr
- **Constraint**: Sentry should surface 401s from the sentiment fetch leg so a rotated/expired `TOGETHER_API_KEY` doesn't silently kill the widget.
- **Implication**: Sentiment client should log 401s explicitly (not swallow); the existing Sentry server config will pick them up.
