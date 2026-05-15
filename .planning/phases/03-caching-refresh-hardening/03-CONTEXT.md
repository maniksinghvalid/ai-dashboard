# Phase 3: Caching & Refresh Hardening - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Source:** Synthesized from a `system-architect` agent read-only architecture review (2026-05-13) of the caching, invalidation, and refresh layers, plus the Phase 3 success criteria in `.planning/ROADMAP.md`.

<domain>
## Phase Boundary

Make the cron refresh path **observably honest** and **concurrency-safe**. This is operational hardening on infrastructure shipped in Phase 1 (cron 3-tier DAG, sentiment engine, `cacheSet` helper, timeseries ZSETs) and Phase 2 (Reddit fetch path) — **no new product surface, no UI**.

The review found four compounding failure modes that make a dead system look healthy. This phase ships, end-to-end:

- **Truthful cache-write reporting (P1 — Critical)** — `cacheSet` returns whether a write actually happened; the cron `summary` reflects *cache writes*, not *fetcher resolution*. Today `summary: "ok"` only means the fetcher didn't throw — an all-upstreams-dead run returns HTTP 200 with an all-green summary and writes nothing to Redis.
- **Distributed cron lock (P2 — High)** — `refreshAllFeeds()` takes a Redis lock so a second concurrent invocation (QStash retries failed/timed-out deliveries) returns early instead of running the tiers and racing on ZSET windows + the sentiment budget.
- **Atomic sentiment budget check (P3 — High)** — replace the non-atomic `redis.get` → `redis.incrby` budget guard in `lib/api/sentiment.ts` with an atomic check-and-consume so two concurrent runs cannot both pass and double-spend `SENTIMENT_DAILY_CHAR_BUDGET`.
- **Remove the dead Vercel daily cron (P5 — Low, false-signal risk)** — delete the `crons` entry from `vercel.json`; it 401s at the Vercel edge under Deployment Protection before reaching the route, showing false-green in Vercel's cron dashboard. Document QStash as the sole working refresh path in `CLAUDE.md`.

**Out of scope for this phase** (see `<deferred>`):
- `maxDuration` budget-collision risk (review Finding 2) — separate phase; it's a timeout-tuning / tier-restructure concern with a different blast radius.
- Stale-fallback masking permanent upstream death (review Finding 4) — deferred to a monitoring/observability phase.

</domain>

<decisions>
## Implementation Decisions

All entries below are **LOCKED** — derived from the system-architect review and the Phase 3 ROADMAP success criteria. The *fix shape* is locked; exact implementation form is planner/executor discretion within these bounds. Planner agents must NOT re-debate the approach.

### P1 — `cacheSet` returns a write signal; cron summary reflects it

- `cacheSet` (`lib/cache/helpers.ts`) **returns a boolean** (or a small typed result) indicating whether a write actually occurred. It returns `false` when the existing empty-array guard (`Array.isArray(data) && data.length === 0`) skips the write.
- `refreshAllFeeds()` in `app/api/cron/refresh/route.ts` **threads that signal** into the `summary` so each source reports a **three-state outcome** — `written` / `skipped_empty` / `fetcher_threw` (exact label strings are discretion, but the three states must be distinguishable). The current binary `"ok"` / `"failed"` is replaced.
- The **YouTube early-return blind spot is in scope**: `fetchYouTubeVideos` returns `[]` at `lib/api/youtube.ts:41-43` *before* reaching `cacheSet`, so neither the write nor the `[cache] skipping empty write` warn ever fires. After this phase, that path must surface as `skipped_empty` in the summary (not `ok`). This requires each Tier 1 fetcher to report whether it actually wrote — either by having the fetcher return a structured result, or by having the cron re-derive the state. Planner picks the mechanism; the constraint is that the YouTube empty path is no longer indistinguishable from success.
- A cron run where **every upstream returns an empty array** must NOT report all-`ok`.

### P2 — Distributed lock around `refreshAllFeeds()`

- `refreshAllFeeds()` acquires a Redis lock at entry via `SET <key> <val> NX EX <ttl>` (Upstash `set` with `nx: true, ex: <ttl>`).
- `ttl` is **strictly greater than `maxDuration` (60)** — use **90 seconds**. This guarantees the lock self-expires after a function hard-kill (timeout/crash) so the system can't deadlock itself.
- A second invocation that **fails to acquire** the lock returns early — HTTP 200 with a distinct body (e.g. `{ status: "locked" }`) — **without running any tier**. HTTP 200 (not 4xx/5xx) is deliberate: a 5xx would make QStash retry the contended call, defeating the purpose.
- The lock is **released on normal completion** (best-effort `del`) and **self-expires** on crash/timeout via the EX ttl. Releasing should be safe even if the lock already expired and was re-acquired by another run — prefer a value-checked delete (only delete if the value is still ours) or accept the small race and rely on the short ttl. Planner's call; document the choice.
- Both the `GET` and `POST` handlers route through `refreshAllFeeds()`, so the lock covers both transports.

### P3 — Atomic sentiment budget check

- The daily-budget **check-and-consume** in `lib/api/sentiment.ts` (currently a non-atomic read-then-write: `redis.get(budgetKey)` then a conditional `redis.incrby`) becomes a **single atomic operation**.
- Acceptable mechanisms (planner picks): an Upstash `eval` Lua script that checks-then-increments-or-rejects in one round trip, OR an atomic `incrby` first followed by a compare that *refunds* (decrements) on overshoot. The Lua approach is cleaner; the incr-first-refund approach avoids shipping a Lua string. Either satisfies the contract.
- **Contract:** two concurrent runs cannot both pass the guard and together push consumption past `SENTIMENT_DAILY_CHAR_BUDGET`. The second concurrent consumer is rejected (circuit-breaker behavior preserved).
- The daily key's expiry/reset semantics already in place must be preserved — do not regress the once-per-day reset.

### P4 — Remove the dead Vercel daily cron

- Delete the daily `crons` entry from `vercel.json` (the `crons` array becomes empty or the key is removed entirely).
- Update the `CLAUDE.md` **Deployment** section: state that **QStash is the sole working refresh path** and explain *why* the Vercel cron was removed — under Deployment Protection (Vercel Authentication) the Vercel edge 401s the cron before it reaches the route, and Vercel's cron dashboard reports that 401 as a successful invocation (false-green). The existing CLAUDE.md "Deployment Protection" table already documents the mechanism — this phase removes the dead config and tightens the prose to match.
- This is the lowest-severity item but it is **in scope** because the false-green is actively misleading during incident response.

### Test coverage (locked)

- New / updated Vitest cases are **required**, following the Phase 1 pure-function-core convention (`environment: "node"`, mock Redis at the boundary):
  - `cacheSet` boolean contract — write occurs → `true`; empty-array guard skip → `false`.
  - Cron lock helper — acquire-success, acquire-contended (second caller rejected), release.
  - Atomic sentiment budget guard — second concurrent consumer is rejected; single consumer under budget passes.
- `npm test` exits 0; `npx tsc --noEmit && npm run lint` clean.

### Claude's Discretion

Areas not nailed down — planner/executor judgment, must still respect the locked fix shapes above and existing project patterns:

- **`cacheSet` return shape** — bare `boolean` vs a small typed result object. Bare boolean is simplest; a typed result is fine if it reads cleaner at the call sites.
- **How Tier 1 fetchers report write state** — return a structured `{ data, wrote }` from each fetcher, vs the cron inferring state from `(fetcher resolved) × (cacheSet returned)`. The constraint is only that the YouTube empty path becomes `skipped_empty`. Pick the mechanism with the smallest blast radius across `lib/api/{youtube,reddit,twitter,news}.ts`.
- **Summary label strings** — `written`/`skipped_empty`/`fetcher_threw` is the suggested vocabulary; planner may choose clearer names as long as the three states are distinguishable in the JSON.
- **Lock key name + value** — e.g. `cron:refresh:lock` with a run-id or timestamp value. Planner's call; keep it consistent with existing `CACHE_KEYS` conventions in `lib/constants.ts` (add it there rather than inlining a literal).
- **Lock release strategy** — value-checked delete vs unconditional delete vs expire-only. Document the chosen trade-off in a code comment (this is exactly the kind of non-obvious WHY that earns a comment).
- **Atomic budget mechanism** — Lua `eval` vs incr-first-then-refund. Either is acceptable.
- **Whether to add a structured-result type to `lib/types.ts`** — only if it genuinely reads cleaner; do not over-abstract a one-call-site boolean.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The source analysis (authoritative for this phase)
- The `system-architect` review is captured in the conversation that produced this phase and is distilled into the `<decisions>` above and the Phase 3 success criteria in `.planning/ROADMAP.md`. Treat the ROADMAP success criteria + this CONTEXT.md as the authoritative spec — there is no separate review artifact file.
- `.planning/ROADMAP.md` — Phase 3 entry: goal, the 5 success criteria, and the `<scope notes>` block (what's folded in vs explicitly deferred).

### Code under the microscope (read before planning)
- `lib/cache/helpers.ts` — `cacheGet<T>(key, maxAgeMs)` / `cacheSet<T>(key, data)`. The empty-array guard lives here (`Array.isArray(data) && data.length === 0`). P1 changes `cacheSet`'s return type. **Note:** the guard only protects array types — object-shaped caches (e.g. `Sentiment`) are not covered; that's a known design smell but NOT in scope this phase (see `<deferred>`).
- `lib/cache/redis.ts` — `getRedis()` lazy client. P2/P3 Redis ops (`set` with `nx`/`ex`, `eval`) go through this client; never `new Redis()` directly.
- `app/api/cron/refresh/route.ts` — `refreshAllFeeds()` is the 3-tier DAG. P1 threads the write signal into `summary`; P2 wraps the function body in the lock. `maxDuration = 60` is exported here — the lock ttl (90) must exceed it. Both `GET` (Bearer) and `POST` (QStash signature) handlers call `refreshAllFeeds()`.
- `lib/api/youtube.ts` — **lines 41-43**: the early-return-`[]` blind spot. `fetchYouTubeVideos` returns before `cacheSet` when no video IDs were collected. P1 must make this path surface as `skipped_empty`.
- `lib/api/reddit.ts`, `lib/api/twitter.ts`, `lib/api/news.ts` — the other Tier 1 fetchers. Each calls `cacheSet` and can pass an empty array through the guard silently. P1's write-signal plumbing touches all four fetchers (or the cron's handling of them — planner's mechanism choice).
- `lib/api/sentiment.ts` — the non-atomic budget check-and-consume (`redis.get` budget key → conditional `redis.incrby`). P3 makes this atomic. Preserve the existing 401 Sentry capture (`tags: { component: "sentiment", reason: "key-rotation-suspected" }`) and the daily reset semantics.
- `lib/constants.ts` — `CACHE_KEYS` + TTLs. Add the new cron-lock key here, not as an inline literal.
- `lib/cache/timeseries.ts` — `zaddTimepoint` / `zrangeWindow` / `capToSlots`. Not modified by this phase, but P2's lock is what *moots* the ZSET member-collision precision bug (review Finding 6) — the planner should note this linkage so no separate ZSET fix is attempted.
- `vercel.json` — the dead daily `crons` entry P4 removes.

### Project conventions (existing patterns to reuse)
- `CLAUDE.md` — Project-wide conventions. **Read before planning.** Especially the "Cron summary truthfulness" and "YouTube cache-skip blind spot" Key Patterns notes (they describe exactly the bugs P1 fixes — update them after the fix lands) and the "Deployment Protection" section (P4 tightens its prose).
- Phase 1 test files — `lib/cache/timeseries.test.ts`, `lib/api/sentiment.test.ts`, `lib/api/trending.test.ts`, `lib/api/alerts.test.ts` — the established Vitest pattern (`environment: "node"`, boundary-mocked Redis) for the new P1/P2/P3 test cases.
- `.planning/phases/01-scrum-38-implementation/01-CONTEXT.md` — the CONTEXT.md format this file follows; also documents D1–D9 / F1–F4 locked decisions that this phase must not regress (esp. D4/D9 cron DAG shape, D1/D7/F1 sentiment budget).

### External docs (planner / executor may need)
- Upstash Redis docs — `SET` with `NX` + `EX` options via the REST client; `EVAL` for the optional Lua-script budget guard. Confirm the exact `@upstash/redis` JS method signatures (`redis.set(key, val, { nx: true, ex: 90 })`, `redis.eval(...)`).
- Vercel docs — `vercel.json` `crons` schema (confirming removal is clean) and the Deployment Protection / bypass behavior already summarized in `CLAUDE.md`.

</canonical_refs>

<specifics>
## Specific Ideas

- **Suggested in-phase ordering** (planner refines into waves):
  1. **P1 — `cacheSet` return signal + cron summary plumbing.** Touches `lib/cache/helpers.ts`, the four Tier 1 fetchers (or the cron's handling of them), and `app/api/cron/refresh/route.ts`. The YouTube `:41-43` blind spot is part of this.
  2. **P2 — cron lock.** New `CACHE_KEYS` entry + lock acquire/release in `refreshAllFeeds()`. Independent of P1 but touches the same `route.ts` — sequence after P1 to avoid churn, or plan as one cron-focused unit.
  3. **P3 — atomic sentiment budget.** Isolated to `lib/api/sentiment.ts`. Fully independent — can run parallel to P1/P2.
  4. **P4 — remove dead Vercel cron + CLAUDE.md prose.** Isolated to `vercel.json` + `CLAUDE.md`. Fully independent — trivial, can be its own small plan or folded with docs.
  5. **Tests** — the three new test groups; co-locate with each fix or as a final plan, planner's call (Phase 1 co-located tests with feature modules).
  6. **CLAUDE.md Key Patterns update** — once P1 lands, the "Cron summary truthfulness" and "YouTube cache-skip blind spot" notes describe *fixed* behavior; update them to describe the new three-state summary contract.

- **Concrete acceptance signals** (must be checkable):
  - A cron run with all four Tier 1 upstreams returning `[]` produces a `summary` with **zero** `written`/`ok` entries — the YouTube source shows `skipped_empty`, not `ok`.
  - `cacheSet(key, [])` returns `false`; `cacheSet(key, [item])` returns `true`.
  - A second `POST /api/cron/refresh` fired while the first is mid-run returns HTTP 200 `{ status: "locked" }` and runs no tier (verifiable by unit-testing the lock helper, and observable in logs).
  - The cron lock key has a TTL > 60s in Redis after acquisition.
  - Two concurrent sentiment budget consumers near the limit: only one passes; total consumption ≤ `SENTIMENT_DAILY_CHAR_BUDGET`.
  - `vercel.json` has no `crons` entry (or an empty array); `grep -A3 '"crons"' vercel.json` reflects the removal.
  - `npm test` exits 0 with the new P1/P2/P3 cases; `npx tsc --noEmit && npm run lint` clean.

- **File-level inventory** (planner confirms):
  - **New:** lock-helper test file(s); possibly a small `lib/cache/lock.ts` if the planner extracts the lock into a helper (discretion — inline in `route.ts` is also acceptable for a single call site).
  - **Modified:** `lib/cache/helpers.ts`, `app/api/cron/refresh/route.ts`, `lib/api/youtube.ts`, `lib/api/reddit.ts`, `lib/api/twitter.ts`, `lib/api/news.ts`, `lib/api/sentiment.ts`, `lib/constants.ts`, `vercel.json`, `CLAUDE.md`, plus test files.

- **Regression guards** — this phase must not regress: D4/D9 (3-tier DAG shape, `maxDuration = 60`), the per-tier `Promise.allSettled` failure isolation, the sentiment 401 Sentry capture, the QStash signature verification path, or the empty-array guard's *intent* (it should still skip empty writes — P1 just makes the skip *visible*, it does not remove the guard).

</specifics>

<deferred>
## Deferred Ideas

Acknowledged by the system-architect review but explicitly **out of scope** for Phase 3 — carry forward:

| Item | Review ref | Why deferred |
|------|-----------|--------------|
| `maxDuration` budget collision — sentiment's 35s `TIMEOUT_MS` vs the 60s function ceiling can hard-kill the function mid-Tier-3 before `cacheSet` runs, with no log signal of which tier died | Finding 2 (High) | Different problem class — timeout-tuning / tier-restructure, not caching-correctness. Different blast radius and testing strategy. Warrants its own phase. |
| Stale-fallback masks permanent upstream death — the 24h safety TTL serves visually-fresh-looking data for up to 24h after an upstream dies permanently; `stale: true` only helps if widgets render it | Finding 4 (Medium) | UX + observability concern, not a refresh-path correctness bug. Belongs in a monitoring/alerting phase (e.g. a webhook that alerts on N consecutive `skipped_empty` runs — which P1's truthful summary now makes *possible*). |
| Trending-to-hero null cascade — `promoteHero()` silently returns `null` when `trendingRanked` is missing (vs stale) with no log line | Finding 5 (Medium) | Observability gap; partially mitigated once P1's summary makes Tier 2 failure visible. Revisit with the monitoring phase. |
| ZSET member-collision precision bug — `zaddTimepoint` members `"${ts}:${count}"` can double-count a second under sub-second concurrent runs | Finding 6 (Medium) | **Mooted by P2** — the cron lock eliminates concurrent runs, so no separate fix is needed. Noted here so the planner does not author a redundant ZSET change. |
| `cacheSet` empty-guard does not protect object-shaped caches (only arrays) | Finding 7 (Low) | Design smell, not a current bug — `Sentiment`'s empty sentinel is intentional. No object-shaped fetcher currently fails into a misleading sentinel. Revisit if/when one is added. |
| Reddit per-subreddit failures swallowed as `[]` (no Sentry, no summary degradation) for non-429/503 errors | Finding 9 (Low) | Partially surfaced by P1's truthful reporting (an all-subreddits-fail run now shows `skipped_empty`). Deeper per-subreddit accounting is planner discretion, not a Phase 3 gate. |

</deferred>

---

*Phase: 03-caching-refresh-hardening*
*Context synthesized: 2026-05-13 from a system-architect architecture review*
