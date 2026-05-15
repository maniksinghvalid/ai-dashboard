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

- [x] **Phase 1: SCRUM-38 Implementation** - Ship the sentiment engine, true velocity trending, cross-platform hero, spike alerts, Vitest, and the cron DAG / dashboard wiring that activates them **(shipped — commits `e28ca7e` "feat(01): ship SCRUM-38 intelligence layer" + `fa5c49f` review fixes + `dd9b6dd` "fix(sentiment): repair Together AI integration and cron summary truthfulness"; retroactively marked complete 2026-05-13 after /superpowers:requesting-code-review validation — see Phase 1 close-out note below)**
- [x] **Phase 2: Reddit Free Fallback** - Replace the failing Apify-based Reddit scraper with Reddit's free public JSON API; restore Reddit data flow into the cron DAG and unblock cross-platform hero promotion **(shipped 2026-05-13 — commits `66b04aa` + `b404c97`; plan + summary backfilled retroactively via /gsd-import)**
- [ ] **Phase 3: Caching & Refresh Hardening** - Close the four compounding failure modes surfaced by the 2026-05-13 system-architect review: truthful cache-write reporting (`summary: "ok"` currently lies — only means the fetcher resolved, not that Redis was written), a distributed cron lock (no protection against concurrent QStash-retry runs), an atomic sentiment budget check (non-atomic read-then-write double-spends quota), and removal of the dead Vercel daily cron (401s silently behind Deployment Protection — false-signal noise during incident response)
- [ ] **Phase 4: Scrollable Feed Cards (SCRUM-49)** - Render up to 15 items in each of the four feed widgets (YouTube, Reddit, X/Twitter, News) inside a scrollable card body with a bottom-fade cue. Cap is enforced at the widget render layer only — fetchers and the trending/velocity pipeline are unchanged. Refined from the original SCRUM-49 draft after a 2026-05-14 codebase validation pass (see ticket history for the rewrite rationale)

## Phase Details

### Phase 1: SCRUM-38 Implementation
**Goal**: Activate the dashboard's intelligence layer — users see live cross-platform AI sentiment, true velocity-ranked trending, and an auto-promoted hero story whenever a topic peaks simultaneously on YouTube, Reddit, and X — all driven by a single 3-tier cron DAG and protected by the project's first unit-test suite.
**Depends on**: SCRUM-36 (data layer, shipped) and SCRUM-37 (UI shell, shipped). No prior GSD phase.
**Requirements**: REQ-sentiment-engine, REQ-env-contract, REQ-trending-velocity, REQ-topic-taxonomy, REQ-spike-alerts, REQ-hero-auto-promotion, REQ-cron-three-tier-dag, REQ-vitest-bootstrap, REQ-sentiment-widget-polish, REQ-dashboard-data-wiring
**Success Criteria** (what must be TRUE):
  1. **Sentiment budget met (amended via D8/D9 — 2026-05-13):** ~~A single `/benchmark` run shows the sentiment refresh leg completing within 5s per cron cycle~~ — superseded. Under D8 (Llama-3.3-70B-Instruct-Turbo LLM-judge) the sentiment leg uses `TIMEOUT_MS = 35_000` and the cron exports `maxDuration = 60` (D9). The remaining contractual surface is: `GET /api/sentiment` returns `{positive, neutral, negative, sampleSize}` with the three percentages summing to 100, cold-miss returns 503, and `SENTIMENT_DAILY_CHAR_BUDGET` trips the circuit breaker before quota overrun. A `/benchmark` run is no longer expected to fit the 5s window and should not be used as a release gate.
  2. **Hero promotes on top-3-on-all-3:** When a topic appears in the top 3 on YouTube **and** Reddit **and** X simultaneously, `GET /api/hero` returns a valid `HeroStory` ranked by aggregate velocity and the `HeroStoryCard` renders the API payload; when no topic qualifies, the route returns 503 and the card falls back to the existing client-side `deriveHeroStory()` (no blank card).
  3. **Trending shows true velocity (not heuristic count):** `GET /api/trending` returns topics ranked by `(count_now − count_1h_ago) / 1h` computed via `zrangeWindow` against the unified `(topic, platform)` ZSETs (D2 storage); the old "count + log2" heuristic is gone; topics come from the typed `AI_TOPICS` taxonomy in `lib/topics.ts` (D5 shape) and word-boundary collision-prone topics like "agents" match correctly.
  4. **Spike alerts emit + cap holds:** When a topic's velocity exceeds 5× its 24h baseline, an entry lands on the `alerts:spikes` Redis list; `LLEN alerts:spikes` stays ≤ 100 at all times because every `LPUSH` is followed by `LTRIM alerts:spikes 0 99`.
  5. **Sentiment widget shows live data:** The `SentimentWidget` displays the live API payload (no hardcoded sample data anywhere), the gate-2 HTML mockup is committed under `arch/`, the widget conforms to the `{data, stale, isLoading, error}` props contract, and `DashboardShell` wraps it in `WidgetErrorBoundary`.
  6. **Cron DAG runs the 3 tiers within the function ceiling (amended via D9 — 2026-05-13):** `app/api/cron/refresh/route.ts` exports `maxDuration = 60` (was 30; bumped because D8's LLM-judge sentiment leg has a 35s timeout). Executes Tier 1 → Tier 2 → Tier 3 sequentially with `Promise.allSettled` per tier; a single failed leg does not block siblings or downstream tiers where they are independent.
  7. **Tests run green:** `npm test` exits 0 with all five required unit-test files present (`lib/topics.test.ts`, `lib/api/sentiment.test.ts` covering `preprocessText`, `lib/api/trending.test.ts` covering velocity + hero threshold, `lib/api/alerts.test.ts` covering spike detection, `lib/cache/timeseries.test.ts`); `vitest.config.ts` uses `environment: "node"` and aliases `@/*` to project root; CLAUDE.md "Commands" lists `npm test`.
  8. **Env contract migrated:** `.env.example` contains `TOGETHER_API_KEY` + `SENTIMENT_DAILY_CHAR_BUDGET` (default ~200000), `HUGGINGFACE_API_TOKEN` is **absent**, and the CLAUDE.md "Environment Variables" section reflects the same.
**Plans**: 11 plans (see below — produced by `/gsd-plan-phase 1`)
**UI hint**: yes

Plans:
- [x] 01-01-PLAN.md — Vitest bootstrap (vitest + @vitest/coverage-v8 + tsx + scripts + vitest.config.ts)
- [x] 01-02-PLAN.md — Topic taxonomy (lib/topics.ts + Topic type + matchTopic + lib/topics.test.ts)
- [x] 01-03-PLAN.md — Types + constants extension (Sentiment + SpikeAlert types; 4 new CACHE_KEYS + tenMin TTL)
- [x] 01-04-PLAN.md — Timeseries ZSET wrapper (lib/cache/timeseries.ts: zaddTimepoint/zrangeWindow/capToSlots + tests)
- [x] 01-05-PLAN.md — Trending velocity refactor (lib/api/trending.ts: AI_TOPICS + ZSET velocity + pickHeroCandidate + tests)
- [x] 01-06-PLAN.md — Spike alerts (lib/api/alerts.ts: detectSpike + writeSpikeAlert with LPUSH+LTRIM pair + tests)
- [x] 01-07-PLAN.md — Sentiment engine + route (lib/api/sentiment.ts + app/api/sentiment/route.ts + tests)
- [x] 01-08-PLAN.md — Hero promoter + route (lib/api/hero.ts + app/api/hero/route.ts with relaxation comment)
- [x] 01-09-PLAN.md — Cron 3-tier DAG (app/api/cron/refresh/route.ts: maxDuration=30 + Tier 1/2/3 Promise.allSettled)
- [x] 01-10-PLAN.md — Dashboard wiring + sentiment widget polish + hero API-first (use-dashboard + SentimentWidget + HeroStoryCard + DashboardShell)
- [x] 01-11-PLAN.md — Env contract + CLAUDE.md updates (.env.example + CLAUDE.md commands/env sections)

**Wave structure** (for parallel execution):
- **Wave 1** (foundations, no inter-deps): 01-01, 01-02, 01-03, 01-04
- **Wave 2** (feature modules, depend on Wave 1): 01-05, 01-06, 01-07, 01-08
- **Wave 3** (orchestration + UI): 01-09, 01-10
- **Wave 4** (docs): 01-11

**Suggested in-phase ordering** (from synthesis Roadmapper hints — refined into the wave structure above):
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

### Phase 2: Reddit Free Fallback
**Goal**: Replace the Apify-based Reddit fetch in `lib/api/reddit.ts` with Reddit's free public JSON API. Eliminate the `Maximum cost per run is lower then actor start cost` failure mode that is currently dropping Reddit out of the cron DAG, restore Reddit posts into the trending velocity calc (D2 ZSETs), and unblock the cross-platform hero promotion threshold (D3 — needs Reddit in top-3 to fire).
**Depends on**: SCRUM-36 (data layer, shipped). Logically independent of Phase 1 (SCRUM-38), but file overlap with Phase 1 plan `01-09-PLAN.md` (cron DAG restructure) means this phase should ship **before** or **after** 01-09 — not concurrently.
**Requirements**: None mapped (operational fix on shipped SCRUM-36 infrastructure; not in the v1 requirements set).
**Success Criteria** (what must be TRUE):
  1. **No Apify dependency on the Reddit code path:** `grep -c ApifyClient lib/api/reddit.ts` returns 0; the module reaches Reddit only via `fetch` to `https://www.reddit.com/r/<sub>/hot.json`.
  2. **Same caller contract:** `fetchRedditPosts(): Promise<RedditPost[]>` signature preserved; `app/api/cron/refresh/route.ts` is unmodified by this phase.
  3. **Per-subreddit failure isolation:** one rejected subreddit (`Promise.allSettled`) does not drop the others; 429/503 triggers a single retry with 2–5s jitter before logging `[reddit] Non-200 response` and returning `[]` for that sub.
  4. **Content filters in place:** stickied posts, NSFW (`over_18`) posts, and posts whose flair fails `isFlairAllowed` are filtered out before normalization; the URL semantic (link-post external URL, not Reddit permalink) is preserved and guarded by a regression test.
  5. **Tests green:** 14 Reddit tests pass across `lib/api/reddit.test.ts` (4 normalizer + 4 isPostKeepable + 6 fetchRedditPosts flow including retry / malformed-body / non-t3 / json-throws paths); `npx tsc --noEmit && npm run lint` clean.
  6. **Env contract documented:** `REDDIT_USER_AGENT` (optional) listed in `.env.example` and `CLAUDE.md` "Environment Variables → Optional"; default UA string committed in source contains no PII.
  7. **Production verified:** after deploying to the `git-develop` branch alias, the next QStash tick refreshes the `reddit:hot` cache without surfacing `[cache] skipping empty write to "reddit:hot"` in Vercel logs.
  8. **7-day OAuth tripwire:** calendar reminder set for 2026-05-20 to check Reddit `Non-200` failure rate; if >20%, escalate to authenticated Reddit OAuth (separate phase).
**Plans**: 1 plan (imported from `arch/reddit-free-fallback-plan.md` via /gsd-import)
**UI hint**: no

Plans:
- [ ] 02-01-PLAN.md — Replace `lib/api/reddit.ts` Apify call path with Reddit free JSON API; add 14 Vitest cases; document optional `REDDIT_USER_AGENT` env var

**Wave structure** (for parallel execution):
- **Wave 1** (sequential, single module): 02-01

**Source plan**: `arch/reddit-free-fallback-plan.md` — imported 2026-05-13 via /gsd-import. Conflict detection found 0 BLOCKERS, 2 WARNINGS (no frontmatter, caller-relationship with Phase 1 plan 01-09 via `fetchRedditPosts()`), 3 INFO (SCRUM-36 scope, new optional env var, no locked-decision conflict). User approved.

**Note on 01-09 coordination**: 01-09 modifies `app/api/cron/refresh/route.ts` and 02-01 modifies `lib/api/reddit.ts` — zero actual file overlap. 01-09 only *calls* `fetchRedditPosts()`; since 02-01 preserves the signature, the order between 01-09 and 02-01 does not matter. Both can be authored in either sequence without merge conflict. (Earlier wording in this section overstated the conflict; corrected after /superpowers:requesting-code-review.)

**Execution evidence (retroactive)**: This phase was executed before the plan was imported into GSD form — the import is post-hoc planning around already-shipped code. Tasks 2 + 4 of the plan landed as commits `66b04aa` ("feat(reddit): add Reddit JSON normalizer with stickied + NSFW filter") and `b404c97` ("feat(reddit): replace Apify scraper with Reddit JSON API") on 2026-05-13. Task 5 sub-step A (local cron smoke) was re-verified during the import session — HTTP 200, 43 fresh Reddit posts, `cachedAt` within 1 minute, `stale: false`. Sub-steps B (production verify) and C (7-day tripwire) tracked via `TODOS.md` "Reddit OAuth tripwire — re-check on 2026-05-20".

### Phase 3: Caching & Refresh Hardening
**Goal**: Make the cron refresh path observably honest and concurrency-safe. After this phase a cron run that writes nothing is visibly distinct from one that succeeded, two overlapping QStash deliveries cannot corrupt ZSET windows or double-spend the sentiment budget, and the Vercel cron dashboard no longer shows false-green for an invocation that never reached the route.
**Depends on**: Phase 1 (cron 3-tier DAG, sentiment engine, `cacheSet` helper, timeseries ZSETs) and Phase 2 (Reddit fetch path), both shipped. Operational hardening on shipped infrastructure — no new product surface.
**Requirements**: None mapped (surfaced by the 2026-05-13 system-architect architecture review, not in the v1 requirements set). Source analysis: `/agents/system-architect` read-only review of `lib/cache/*`, `app/api/cron/refresh/route.ts`, and the `lib/api/*` fetchers.
**Success Criteria** (what must be TRUE):
  1. **`summary` reflects cache writes, not fetcher resolution (P1 — Critical):** `cacheSet` returns a boolean indicating whether a write actually occurred (false on the empty-array guard skip). `refreshAllFeeds` threads that signal so each source in the cron JSON reports a three-state outcome (e.g. `written` / `skipped_empty` / `fetcher_threw`) rather than the binary `ok`/`failed`. A cron run where every upstream returns an empty array no longer reports all-`ok`. The YouTube early-return path at `lib/api/youtube.ts:41-43` (returns `[]` before reaching `cacheSet`) is covered — its outcome surfaces as `skipped_empty`, not `ok`.
  2. **Concurrent cron runs are prevented (P2 — High):** `refreshAllFeeds()` acquires a Redis lock via `SET <key> <val> NX EX <ttl>` with `ttl` strictly greater than `maxDuration` (60) — e.g. 90 — at entry, and a second invocation that fails to acquire returns early (HTTP 200, `{ status: "locked" }` or equivalent) without running any tier. The lock is released on normal completion and self-expires on crash/timeout. A unit test covers acquire-success, acquire-contended, and release.
  3. **Sentiment budget check is atomic (P3 — High):** the daily-budget check-and-consume in `lib/api/sentiment.ts` (currently a non-atomic `redis.get` then `redis.incrby`) is replaced with an atomic operation (Lua script or a single pipelined check-and-increment) such that two concurrent runs cannot both pass the guard and together exceed `SENTIMENT_DAILY_CHAR_BUDGET`. A unit test demonstrates the atomic guard rejects the second concurrent consumer.
  4. **Dead Vercel daily cron removed (P5 — Low, but false-signal risk):** the daily `crons` entry is removed from `vercel.json` (the file's `crons` array is empty or absent); `CLAUDE.md`'s Deployment section is updated to state QStash is the sole working refresh path and to explain why the Vercel cron was removed (it 401s at the edge under Deployment Protection before reaching the route, showing false-green in Vercel's cron dashboard).
  5. **Tests green:** `npm test` exits 0 with new/updated cases for the `cacheSet` boolean contract, the cron lock helper, and the atomic sentiment budget guard; `npx tsc --noEmit && npm run lint` clean.
**Plans**: 4 plans (see below — produced by `/gsd-plan-phase 3`)
**UI hint**: no

Plans:
- [ ] 03-01-PLAN.md — P1: `cacheSet` returns a write boolean + pure `deriveSourceOutcome` helper; cron Tier 1 summary becomes three-state (written/skipped_empty/fetcher_threw); CLAUDE.md Key Patterns notes updated [SC-1, SC-5]
- [ ] 03-02-PLAN.md — P2: `cron:refresh:lock` key + `lib/cache/lock.ts` (acquire/release, SET NX EX 90, value-checked Lua release); lock wraps `refreshAllFeeds()` so both GET/POST are covered, contended → HTTP 200 {status:"locked"} [SC-2, SC-5]
- [ ] 03-03-PLAN.md — P3: atomic sentiment daily-budget check-and-consume via single `redis.eval` Lua script; concurrent-consumer guard tests; 401 Sentry capture + daily-key semantics preserved [SC-3, SC-5]
- [ ] 03-04-PLAN.md — P4: remove dead daily `crons` entry from `vercel.json`; tighten CLAUDE.md Deployment prose (QStash sole refresh path, false-green explanation) [SC-4]

**Wave structure** (for parallel execution):
- **Wave 1** (independent — no inter-deps): 03-01 (P1), 03-03 (P3), 03-04 (P4)
- **Wave 2** (depends on 03-01 — both modify `app/api/cron/refresh/route.ts`): 03-02 (P2)

**Sequencing note**: 03-01 and 03-02 both touch `app/api/cron/refresh/route.ts` (03-01 rewrites the Tier 1 summary, 03-02 wraps `refreshAllFeeds()` in the lock) — 03-02 is Wave 2 so the two edits do not collide. 03-03 (`lib/api/sentiment.ts`) and 03-04 (`vercel.json` + `CLAUDE.md`) share no files with each other or with 03-01, so all three run in parallel in Wave 1. SC-5 (suite green) is satisfied incrementally — each code plan co-locates its tests; the phase gate is `npm test && npx tsc --noEmit && npm run lint` after Wave 2.

**Scope notes:**
- **In scope as planner discretion (mooted/folded by the above):** the ZSET member-collision precision bug (system-architect Finding 6) is mooted once SC-2's lock lands — no separate criterion. Reddit per-subreddit silent `[]` returns (Finding 9) are partially surfaced by SC-1's truthful reporting; deeper per-subreddit accounting is discretion, not a gate.
- **Explicitly out of scope:** the `maxDuration` budget-collision risk (system-architect Finding 2 — sentiment's 35s timeout vs the 60s function ceiling) is a real High finding but is a *timeout-tuning / tier-restructure* concern, not a caching-correctness one. Carry it to a separate phase rather than bundling — it has a different blast radius and testing strategy. Stale-fallback masking permanent upstream death (Finding 4) is a UX/observability concern deferred to a monitoring phase.

### Phase 4: Scrollable Feed Cards (SCRUM-49)
**Goal**: Render up to 15 items in each of the four feed widgets (YouTube, Reddit, X/Twitter, News) inside a scrollable card body with a bottom-fade cue when more content is below the fold. The cap is enforced at the widget render layer only; fetchers and the trending/velocity pipeline are unchanged. The 3-column dashboard grid (`lg:grid-cols-2 xl:grid-cols-[280px_1fr_280px]`) must remain visually balanced at ≥1280px viewport.
**Depends on**: Phase 1 (UI shell + widget contract) and SCRUM-48 (curated sources, merged `0d0d928` 2026-05-14). Independent of Phase 2 and Phase 3.
**Requirements**: None mapped (SCRUM-49 is a UX enhancement on the shipped UI shell — not in the v1 requirements set in `REQUIREMENTS.md`). Source: SCRUM-49 (refined 2026-05-14 against the live codebase).
**Success Criteria** (what must be TRUE):
  1. **15-item cap is widget-layer:** each of `YouTubeWidget.tsx`, `RedditWidget.tsx`, `XFeedWidget.tsx`, `NewsWidget.tsx` renders `data.slice(0, MAX_FEED_ITEMS)` where `MAX_FEED_ITEMS = 15` is exported from `lib/constants.ts`. No hardcoded `15` in any widget. The four fetchers (`fetchYouTubeVideos`, `fetchRedditPosts`, `fetchTweets`, `fetchNews`) are unchanged — `git diff --stat` shows zero lines touched in `lib/api/youtube.ts`, `lib/api/reddit.ts`, `lib/api/twitter.ts`, `lib/api/news.ts`.
  2. **WidgetCard supports scrollable bodies:** `components/widgets/WidgetCard.tsx` accepts optional `scrollable?: boolean` and `maxBodyHeight?: string` props. When `scrollable` is true, the body wrapper has `relative ${maxBodyHeight} overflow-y-auto scrollbar-thin`, receives `tabIndex={0}`, `role="region"`, and an `aria-label` derived from the `title` prop, and renders an absolutely-positioned bottom-fade sibling (`aria-hidden="true"`, `pointer-events-none`, `bg-gradient-to-t from-[var(--surface)] to-transparent`).
  3. **Bottom-fade is scroll-aware:** the bottom-fade overlay is hidden when the user scrolls to the bottom of the container and visible otherwise. A client effect / `scrollend` handler toggles its visibility — no permanent fade obscuring the last item.
  4. **Scrollbar styling is Tailwind-native:** a `.scrollbar-thin` utility class is added to `app/globals.css` covering both `::-webkit-scrollbar` (Chrome/Safari, 4px wide, rounded, themed via existing surface tokens) and Firefox (`scrollbar-width: thin; scrollbar-color: var(--surface-2) transparent`). Scrollbar visibility is hover-scoped on the card.
  5. **Three-column grid stays balanced:** at viewport widths ≥1280px the left, center, and right columns do not visibly diverge in height by more than the existing column-balance tolerance of the unmodified live dashboard. `lib/api/trending.ts` and `lib/api/hero.ts` continue to receive the full pre-slice arrays (no regressions in trending velocity or hero promotion).
  6. **Tests + types green:** `npm test` exits 0; `npx tsc --noEmit && npm run lint` clean; new render-time tests cover the `scrollable` WidgetCard branch and the per-widget slice cap.
  7. **Cross-browser:** the scrollable card body and bottom-fade render correctly in Chrome, Firefox, and Safari (Firefox uses native thin scrollbar via `scrollbar-width`).
**Plans**: 8 plans (see below — produced by `/gsd-plan-phase 4`)
**UI hint**: yes

Plans:
- [ ] 04-01-PLAN.md — Wave 0: install @testing-library/react + @testing-library/dom + jsdom; extend vitest.config.ts include glob to .tsx
- [ ] 04-02-PLAN.md — Wave 1: add `MAX_FEED_ITEMS = 15` export to lib/constants.ts + lib/constants.test.ts assertion (D2)
- [ ] 04-03-PLAN.md — Wave 1: extend WidgetCard.tsx with scrollable + maxBodyHeight + scroll-aware fade + a11y + group class; co-author WidgetCard.test.tsx (D3/D4/D5/D8)
- [ ] 04-04-PLAN.md — Wave 2: YouTubeWidget rewire (slice + WidgetCard wiring) + YouTubeWidget.test.tsx (D1 + D9)
- [ ] 04-05-PLAN.md — Wave 2: RedditWidget rewire + RedditWidget.test.tsx (D1)
- [ ] 04-06-PLAN.md — Wave 2: XFeedWidget rewire + XFeedWidget.test.tsx (D1)
- [ ] 04-07-PLAN.md — Wave 2: NewsWidget rewire + NewsWidget.test.tsx (D1 + D9)
- [ ] 04-08-PLAN.md — Wave 2: `.scrollbar-thin` utility in app/globals.css (webkit + Firefox) + phase-end layer-discipline gate (D6 + SC-1 layer invariant)

**Wave structure** (for parallel execution):
- **Wave 0** (devDep + config foundation, must finish before Wave 1): 04-01
- **Wave 1** (constants + WidgetCard extension — parallel within wave; both depend only on Wave 0): 04-02, 04-03
- **Wave 2** (per-widget rewires + globals.css + final gate — all four feed-widget plans are parallel; 04-08 depends on 03+04+05+06+07): 04-04, 04-05, 04-06, 04-07, 04-08

**Out of scope (explicit, deferred to separate work):**
- Fetcher changes (would degrade trending/velocity which consume full arrays).
- Scroll behavior on Hero / Trending / Sentiment widgets — they are not feed widgets.
- A "{n} new since last cache refresh" diff badge — no underlying snapshot/diff mechanism exists; this is net-new work and out of scope here.

## Progress

**Execution Order:**
Phase 1 → Phase 2 → Phase 3 → Phase 4. No decimals planned. Phase 2 imported post-roadmap from operational urgency (Apify failing in prod). Phase 3 added 2026-05-13 from a system-architect architecture review. Phase 4 added 2026-05-14 from SCRUM-49 (Jira story refined against the codebase before planning).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. SCRUM-38 Implementation | 11/11 (retroactive) | **Complete with D8/D9 amendments** | 2026-05-13 (commits `e28ca7e` + `fa5c49f` + `dd9b6dd`) |
| 2. Reddit Free Fallback | 1/1 (retroactive) | **Complete (retroactive import)** | 2026-05-13 (commits `66b04aa` + `b404c97`) |
| 3. Caching & Refresh Hardening | 0/4 | **Planned** | — |
| 4. Scrollable Feed Cards (SCRUM-49) | 0/8 | **Planned** | — |

---

### Phase 1 close-out note (retroactive)

Phase 1 was shipped in commit `e28ca7e` ("feat(01): ship SCRUM-38 intelligence layer") with two follow-up fix commits (`fa5c49f`, `dd9b6dd`). All 58 unit tests pass on the current tree; `npx tsc --noEmit` clean; `npm run lint` clean.

A retroactive validation run via /superpowers:requesting-code-review (2026-05-13) confirmed 8 of 11 plans MET in full, 0 MISSED, and 2 PARTIAL due to **locked-decision drift**:

- **D7 → D8 amendment**: shipped code uses `meta-llama/Llama-3.3-70B-Instruct-Turbo` (chat-completions LLM-judge classifier) instead of the originally-locked `cardiffnlp/twitter-roberta-base-sentiment-latest`. Substitution made at execution time; documented in PROJECT.md D8. The originally-cited 5s budget premise is no longer applicable.
- **F3 → D9 amendment**: cron exports `maxDuration = 60` instead of the originally-locked `30`. Necessary because D8's LLM-judge sentiment leg uses `TIMEOUT_MS = 35_000`. Documented in PROJECT.md D9.
- **CON-key-rotation-observability**: was a real gap (no Sentry capture on 401); fixed in this close-out by adding `Sentry.captureException` with `tags: { component: "sentiment", reason: "key-rotation-suspected" }` at `lib/api/sentiment.ts:174-194` before the throw.

Per-plan SUMMARY.md files were not backfilled (light-touch close-out — commit history is the evidence trail).
