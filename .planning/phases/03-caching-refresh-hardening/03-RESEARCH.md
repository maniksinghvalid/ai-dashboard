# Phase 3: Caching & Refresh Hardening - Research

**Researched:** 2026-05-13
**Domain:** Upstash Redis (REST client) atomicity, distributed locking, cron observability — operational hardening, no new product surface
**Confidence:** HIGH

## Summary

Phase 3 is operational hardening on shipped Phase 1/2 infrastructure. The fix *shapes* are LOCKED in `03-CONTEXT.md` — this research nails down the *mechanics* the planner needs: the exact `@upstash/redis` v1.37.0 API surface for `SET ... NX EX`, `EVAL` (Lua), and value-checked delete; the precise current code shape (signatures + line numbers) of every file P1–P4 touches; and the established Vitest boundary-mocking pattern for the new test cases.

The `@upstash/redis` client is the REST-transport client (`getRedis()` in `lib/cache/redis.ts`). Every Redis command is a single HTTP round trip — there is **no MULTI/transaction** over REST, so multi-step atomicity (P2 lock release, P3 budget check-and-consume) must use either a single command with the right flags (`SET ... NX EX` is one command, inherently atomic) or `EVAL` (Lua runs server-side atomically). This is the single most important constraint for the planner: do NOT compose atomicity from `get` + `set`/`incrby`/`del` — that is exactly the P3 bug.

**Primary recommendation:** P2 lock acquire = `redis.set(key, val, { nx: true, ex: 90 })` (returns `"OK"` on acquire, `null` on contention). P2 lock release + P3 atomic budget = `redis.eval(script, [key], [args])` Lua scripts (the only REST-safe way to do compare-and-delete and check-then-incr atomically). Mock Redis at the `getRedis()` boundary in Vitest exactly as `timeseries.test.ts` / `alerts.test.ts` already do.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**P1 — `cacheSet` returns a write signal; cron summary reflects it**
- `cacheSet` (`lib/cache/helpers.ts`) **returns a boolean** (or small typed result) indicating whether a write actually occurred. Returns `false` when the empty-array guard (`Array.isArray(data) && data.length === 0`) skips the write.
- `refreshAllFeeds()` threads that signal into `summary` so each source reports a **three-state outcome** — `written` / `skipped_empty` / `fetcher_threw` (exact label strings are discretion; the three states must be distinguishable). The binary `"ok"`/`"failed"` is replaced.
- YouTube early-return blind spot **is in scope**: `fetchYouTubeVideos` returns `[]` at `lib/api/youtube.ts:48-50` *before* reaching `cacheSet`. After this phase that path surfaces as `skipped_empty`, not `ok`. Planner picks the mechanism (structured fetcher return vs cron re-derivation).
- A cron run where every upstream returns `[]` must NOT report all-`ok`.

**P2 — Distributed lock around `refreshAllFeeds()`**
- Acquire at entry via `SET <key> <val> NX EX <ttl>` (Upstash `set` with `nx: true, ex: <ttl>`).
- `ttl` **strictly greater than `maxDuration` (60)** — use **90 seconds**. Guarantees self-expiry after a function hard-kill.
- A second invocation that fails to acquire returns early — **HTTP 200** with a distinct body (e.g. `{ status: "locked" }`) — without running any tier. HTTP 200 (not 4xx/5xx) is deliberate: a 5xx makes QStash retry.
- Lock released on normal completion (best-effort `del`) and self-expires on crash/timeout. Prefer a value-checked delete (only delete if value is still ours) or accept the small race and rely on the short ttl — planner's call, document it.
- Both `GET` and `POST` handlers route through `refreshAllFeeds()`, so the lock covers both transports.

**P3 — Atomic sentiment budget check**
- The daily-budget check-and-consume in `lib/api/sentiment.ts` (`checkAndConsumeBudget`, currently non-atomic `redis.get` → conditional `redis.incrby`) becomes a **single atomic operation**.
- Acceptable mechanisms: an Upstash `eval` Lua script (check-then-incr-or-reject in one round trip), OR atomic `incrby` first then a compare that *refunds* (decrements) on overshoot. Lua is cleaner; incr-first-refund avoids shipping a Lua string. Either satisfies the contract.
- **Contract:** two concurrent runs cannot both pass and together push consumption past `SENTIMENT_DAILY_CHAR_BUDGET`. Second concurrent consumer is rejected.
- Preserve the daily key's expiry/reset semantics (`BUDGET_EXPIRE_SECONDS = 86_400 * 2`, `todayKey()` UTC date key).

**P4 — Remove the dead Vercel daily cron**
- Delete the daily `crons` entry from `vercel.json` (the `crons` array becomes empty or the key is removed entirely).
- Update `CLAUDE.md` Deployment section: QStash is the sole working refresh path; explain *why* (Vercel edge 401s the cron under Deployment Protection before it reaches the route, false-green in Vercel's cron dashboard).

**Test coverage (locked)**
- New/updated Vitest cases required, Phase 1 convention (`environment: "node"`, mock Redis at the boundary):
  - `cacheSet` boolean contract — write occurs → `true`; empty-array guard skip → `false`.
  - Cron lock helper — acquire-success, acquire-contended (second caller rejected), release.
  - Atomic sentiment budget guard — second concurrent consumer rejected; single consumer under budget passes.
- `npm test` exits 0; `npx tsc --noEmit && npm run lint` clean.

### Claude's Discretion
- `cacheSet` return shape — bare `boolean` vs small typed result object.
- How Tier 1 fetchers report write state — structured `{ data, wrote }` return vs cron inferring from `(fetcher resolved) × (cacheSet returned)`. Constraint: YouTube empty path becomes `skipped_empty`. Pick smallest blast radius across `lib/api/{youtube,reddit,twitter,news}.ts`.
- Summary label strings — `written`/`skipped_empty`/`fetcher_threw` suggested; planner may pick clearer names if the three states stay distinguishable.
- Lock key name + value — e.g. `cron:refresh:lock` with a run-id/timestamp value. Add to `CACHE_KEYS` in `lib/constants.ts`, not an inline literal.
- Lock release strategy — value-checked delete vs unconditional delete vs expire-only. Document the trade-off in a code comment.
- Atomic budget mechanism — Lua `eval` vs incr-first-then-refund.
- Whether to add a structured-result type to `lib/types.ts` — only if it genuinely reads cleaner.

### Deferred Ideas (OUT OF SCOPE)
- `maxDuration` budget collision (sentiment 35s timeout vs 60s ceiling) — Finding 2 — separate phase, timeout-tuning/tier-restructure.
- Stale-fallback masks permanent upstream death — Finding 4 — monitoring/observability phase.
- Trending-to-hero null cascade — Finding 5 — observability gap, monitoring phase.
- ZSET member-collision precision bug — Finding 6 — **mooted by P2's lock**; do NOT author a separate ZSET fix.
- `cacheSet` empty-guard doesn't protect object-shaped caches — Finding 7 — design smell, not a current bug.
- Reddit per-subreddit silent `[]` returns — Finding 9 — partially surfaced by P1; deeper accounting is discretion, not a gate.

## Project Constraints (from CLAUDE.md)

- **Redis client:** Always use `getRedis()` from `@/lib/cache/redis`; never `new Redis()` directly. Lazy-init is required because Upstash validates URLs at construction time, which breaks `next build` without env vars. All P2/P3 Redis ops go through this client.
- **Cron summary truthfulness** Key Pattern: `summary: "ok"` only means the fetcher didn't throw — it does NOT mean cache was written. This is exactly the bug P1 fixes; **the CLAUDE.md note must be updated after P1 lands** to describe the new three-state contract.
- **YouTube cache-skip blind spot** Key Pattern: `fetchYouTubeVideos` returns early at `lib/api/youtube.ts:41-43` (actually `:48-50` in the current tree — see Code Shape below) before reaching `cacheSet`; the `[cache] skipping empty write` warn never fires. P1 must surface this as `skipped_empty`; update the CLAUDE.md note after.
- **Deployment Protection** section: documents the mechanism P4's prose tightening builds on — the Vercel edge 401s before the route under Vercel Authentication. P4 removes the dead `crons` config and aligns the prose.
- **Tests:** `npm test` is Vitest, pure-function core. New test files follow the established pattern.
- **Lint/typecheck:** `npm run lint` is ESLint with Prettier compatibility; `npx tsc --noEmit` must be clean.
- **Git workflow:** working branch `develop`; current branch is `feature/reddit-free-fallback`. Jira key `SCRUM`.
- **Regression guards (from CONTEXT `<specifics>`):** must not regress D4/D9 (3-tier DAG, `maxDuration = 60`), per-tier `Promise.allSettled` failure isolation, sentiment 401 Sentry capture, QStash signature verification, or the empty-array guard's intent (still skip empty writes — P1 makes the skip visible, not removed).

## Phase Requirements

This phase has **no mapped REQ-* IDs** — it was surfaced by the 2026-05-13 system-architect review, not the v1 requirements set. The authoritative spec is the 5 ROADMAP success criteria + `03-CONTEXT.md`. Mapping below uses the ROADMAP SC numbers.

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 (P1) | `cacheSet` returns write boolean; cron `summary` three-state; YouTube `:48-50` empty path → `skipped_empty` | Code Shape §`helpers.ts` + §`route.ts` + §`youtube.ts`; mechanism options in Architecture Patterns |
| SC-2 (P2) | Redis lock via `SET NX EX 90` around `refreshAllFeeds()`; contended caller → HTTP 200 `{status:"locked"}`; release on completion, self-expire on crash | Standard Stack §`set`/`eval`; Architecture Patterns §Lock; Pitfalls §release race |
| SC-3 (P3) | Atomic sentiment budget check-and-consume (Lua `eval` or incr-first-refund) | Code Shape §`sentiment.ts`; Architecture Patterns §Atomic budget; Standard Stack §`eval` |
| SC-4 (P4) | Remove `crons` from `vercel.json`; update `CLAUDE.md` Deployment prose | Code Shape §`vercel.json`; Architecture Patterns §P4 |
| SC-5 | `npm test` green w/ new cases; `tsc --noEmit && lint` clean | Validation Architecture; Code Examples §Vitest mocking |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cache-write truthfulness (P1) | API / Backend (`lib/cache/helpers.ts` + `lib/api/*` fetchers) | API route (`route.ts` summary) | The write decision lives in `cacheSet`; the *reporting* is the cron route's job |
| Cron concurrency lock (P2) | API route (`app/api/cron/refresh/route.ts`) | Database/Storage (Redis lock key) | Lock is a route-entry concern; Redis is just the coordination substrate |
| Sentiment budget atomicity (P3) | API / Backend (`lib/api/sentiment.ts`) | Database/Storage (Redis counter + Lua) | Budget logic is sentiment-module-internal; atomicity is enforced server-side in Redis |
| Dead cron removal (P4) | Build/Config (`vercel.json`) + Docs (`CLAUDE.md`) | — | Pure config + prose; no runtime code |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@upstash/redis` | **1.37.0** (verified — `package.json` + installed `node_modules/@upstash/redis/package.json`) | REST-transport Redis client; `set` (NX/EX), `eval` (Lua), `del`, `get`, `incrby`, `expire` | Already the project's only Redis client; accessed exclusively via `getRedis()` |
| `vitest` | 4.1.5 (verified — `package.json` devDeps) | Unit test runner, `environment: "node"` | Project's only test framework (D6) |
| `@vitest/coverage-v8` | 4.1.5 | Coverage | Phase 1 bootstrap |

No new dependencies needed. P3's Lua script (if chosen) is an inline string passed to `redis.eval` — not a package.

### `@upstash/redis` v1.37.0 — verified API surface

**`redis.set(key, value, opts?)`** — `[CITED: upstash.com/docs/redis/sdks/ts/commands/string/set]`
- Options object supports `nx: boolean`, `xx: boolean`, `ex: number` (seconds), `px`, `exat`, `pxat`, `keepTtl`, `get`. **`nx` and `ex` can be combined** in one call: `redis.set(key, val, { nx: true, ex: 90 })`.
- **Return value:** `"OK"` when the key was set. **`null` when a conditional flag (`nx`/`xx`) prevented the write** — i.e. a contended NX acquire returns `null`. `[VERIFIED: Upstash SDK + Redis protocol semantics — SET with NX returns the bulk-string OK or nil]`
- Non-string values are `JSON.stringify`'d automatically (this is how `cacheSet` stores `CachedData<T>` objects today). For a lock value, pass a plain string (run-id / ISO timestamp) to avoid JSON-wrapping surprises.
- TypeScript: the return type is `Promise<...>`; treat the result as `"OK" | null` and branch on truthiness. The planner should compare `=== "OK"` (or `!== null`) explicitly rather than relying on a typed boolean.

**`redis.eval(script, keys, args)`** — `[CITED: upstash.com/docs/redis/sdks/ts/commands/scripts/eval]`
- Signature: `redis.eval(script: string, keys: string[], args: unknown[])`. **All three positional args; `keys` and `args` are required (pass `[]` if none).** Example from official docs: `await redis.eval(`return ARGV[1]`, [], ["hello"])` → `"hello"`.
- Inside the script: `KEYS[1]`, `KEYS[2]`, … and `ARGV[1]`, `ARGV[2]`, … (1-indexed, Lua convention).
- Runs server-side **atomically** — the whole script is one Redis operation. This is the *only* way to do multi-step atomicity over the Upstash REST transport (there is no MULTI/EXEC over REST).
- **Return-type coercion quirk:** Lua return values are coerced to Redis reply types, then JSON-decoded by the client. Lua numbers come back as JavaScript numbers; Lua strings as strings; `nil` as `null`; Lua `true` → `1`, Lua `false` → `null` (Redis has no boolean reply type). **Recommendation:** have the Lua script `return` an explicit integer sentinel (e.g. `return 1` for consumed / `return 0` for rejected) rather than a boolean, and coerce on the JS side. Do not rely on Lua boolean → JS boolean.
- `ARGV` values arrive in Lua as **strings** — inside the script, wrap numeric args in `tonumber(ARGV[1])` before arithmetic/comparison. This is the classic Lua-budget-script bug.

**`redis.del(key)`** — returns the integer count of keys deleted (`0` or `1` for a single key). There is **no built-in compare-and-delete** in the client. For a value-checked release ("delete only if the lock value is still mine"), you MUST use a Lua `eval` script — the canonical Redlock release script:
```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
```

**`redis.get<T>(key)`**, **`redis.incrby(key, n)`** (returns the post-increment integer), **`redis.expire(key, seconds)`** — all single-round-trip, already used in the codebase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `eval` for P3 atomic budget | `incrby` first, then compare result vs budget, `incrby` negative delta to refund on overshoot | Avoids shipping a Lua string; but is 2 round trips and the refund window briefly over-reports consumption (cosmetic — the *guard* is still correct because the second consumer sees the inflated value and is rejected). Both satisfy the contract per CONTEXT. |
| `eval` for P2 value-checked release | Unconditional `del` + accept the tiny race | Unconditional `del` is 1 line, no Lua; the race (deleting a lock another run just re-acquired after ttl expiry) is real but bounded by the 90s ttl and only matters if a run runs >90s. CONTEXT explicitly allows this — "Planner's call; document the choice." |
| Extracting `lib/cache/lock.ts` helper | Inline lock in `route.ts` | Single call site → inline is acceptable per CONTEXT. A helper is cleaner for unit-testing the acquire/contend/release trio in isolation (the locked test requirement). Lean toward a small `lib/cache/lock.ts` purely so the test can target it at the boundary like `timeseries.ts`. |

**Installation:** No new packages. `@upstash/redis@1.37.0` already installed.

**Version verification:** `@upstash/redis` confirmed `1.37.0` via `node_modules/@upstash/redis/package.json` (matches the `^1.37.0` range in `package.json`). `vitest` / `@vitest/coverage-v8` confirmed `4.1.5`.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
   QStash POST ───► │  POST handler  (verify upstash-signature)    │
   (every 15min)    └───────────────────┬─────────────────────────┘
                                        │
   Manual GET   ───► ┌──────────────────┴──────────────┐
   (Bearer)          │  GET handler  (verify CRON_SECRET)│
                     └──────────────────┬──────────────┘
                                        │
                          ┌─────────────▼──────────────┐
                          │      refreshAllFeeds()     │
                          │                            │
              P2 ────────►│  1. acquireLock(NX EX 90)  │──┐ null (contended)
                          │     OK? ──no──────────────────┼──► return 200 {status:"locked"}
                          │     yes ▼                  │  │   (NO tier runs)
                          │  ┌──────────────────────┐  │  │
                          │  │ Tier 1: yt‖reddit‖   │  │  │
              P1 ────────►│  │   twitter‖news       │  │  │
                          │  │  each → cacheSet()   │  │  │
                          │  │  → wrote: bool ──────┼──┼──┼──► summary[src] =
                          │  └──────────┬───────────┘  │  │    written|skipped_empty|fetcher_threw
                          │  ┌──────────▼───────────┐  │  │
                          │  │ Tier 2: trending     │  │  │
                          │  └──────────┬───────────┘  │  │
                          │  ┌──────────▼───────────┐  │  │
                          │  │ Tier 3: hero‖alerts‖ │  │  │
              P3 ────────►│  │   sentiment          │  │  │
                          │  │  budget: eval(Lua)   │──┼──┼──► Redis (atomic check+incr)
                          │  └──────────┬───────────┘  │  │
              P2 ────────►│  2. releaseLock (best-eff) │◄─┘  │
                          │     return 200 {summary}   │     │
                          └────────────────────────────┘     │
                                                             ▼
                                              ┌──────────────────────────┐
                                              │  Upstash Redis (REST)    │
                                              │  cron:refresh:lock (P2)  │
                                              │  sentiment:budget:DATE   │
                                              │  yt:latest, reddit:hot…  │
                                              └──────────────────────────┘
```

### Recommended Project Structure

No structural change. Files modified (per CONTEXT `<specifics>` file-level inventory):
```
lib/cache/helpers.ts        # P1: cacheSet returns boolean
lib/cache/lock.ts           # P2: NEW (optional) — acquire/release helper
lib/cache/lock.test.ts      # P2: NEW — acquire/contend/release tests
lib/cache/helpers.test.ts   # P1: NEW — cacheSet boolean contract
app/api/cron/refresh/route.ts  # P1: summary plumbing; P2: lock wrap
lib/api/youtube.ts          # P1: surface :48-50 empty path
lib/api/reddit.ts           # P1: write-signal plumbing
lib/api/twitter.ts          # P1: write-signal plumbing
lib/api/news.ts             # P1: write-signal plumbing
lib/api/sentiment.ts        # P3: atomic checkAndConsumeBudget
lib/api/sentiment.test.ts   # P3: extend with budget guard cases
lib/constants.ts            # P2: add cron-lock key to CACHE_KEYS
vercel.json                 # P4: remove crons entry
CLAUDE.md                   # P4: Deployment prose; P1: Key Patterns notes
lib/types.ts                # P1: only if a structured result type reads cleaner
```

### Pattern 1: Distributed lock with NX EX (P2)
**What:** Single-command atomic lock acquire; ttl > maxDuration guarantees self-healing.
**When to use:** Entry of `refreshAllFeeds()`, before any tier runs.
**Example:**
```typescript
// Source: upstash.com/docs/redis/sdks/ts/commands/string/set + Redis lock pattern
const lockValue = `${Date.now()}-${crypto.randomUUID()}`; // unique per invocation
const acquired = await redis.set(CACHE_KEYS.cronLock, lockValue, {
  nx: true,
  ex: 90, // strictly > maxDuration (60) so a hard-killed function self-heals
});
if (acquired !== "OK") {
  // contended — another invocation holds the lock. 200 (not 5xx) so QStash won't retry.
  return NextResponse.json({ status: "locked" }, { status: 200 });
}
try {
  // ... run tiers ...
} finally {
  // value-checked release — only delete if the lock is still ours
  await redis.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
    [CACHE_KEYS.cronLock],
    [lockValue],
  );
}
```

### Pattern 2: Atomic check-and-consume budget via Lua (P3)
**What:** Replace `get` → conditional `incrby` with one server-side atomic script.
**When to use:** `checkAndConsumeBudget` in `lib/api/sentiment.ts`.
**Example:**
```typescript
// Source: Redis EVAL atomicity + upstash.com/docs/redis/sdks/ts/commands/scripts/eval
// ARGV arrive as strings — tonumber() before arithmetic. Return an integer
// sentinel (1=consumed, 0=rejected), NOT a Lua boolean.
const CONSUME_BUDGET = `
  local current = tonumber(redis.call("get", KEYS[1]) or "0")
  local needed = tonumber(ARGV[1])
  local budget = tonumber(ARGV[2])
  local ttl = tonumber(ARGV[3])
  if current + needed > budget then
    return 0
  end
  redis.call("incrby", KEYS[1], needed)
  redis.call("expire", KEYS[1], ttl)
  return 1
`;
const result = await redis.eval(CONSUME_BUDGET, [key], [charsNeeded, budget, BUDGET_EXPIRE_SECONDS]);
return result === 1;
```
**Alternative (incr-first-refund, no Lua string):**
```typescript
const after = await redis.incrby(key, charsNeeded);
await redis.expire(key, BUDGET_EXPIRE_SECONDS);
if (after > budget) {
  await redis.incrby(key, -charsNeeded); // refund the overshoot
  return false;
}
return true;
```

### Pattern 3: cacheSet returns a write boolean (P1)
**What:** `cacheSet` returns `boolean` (or `{ wrote: boolean }`); the empty-array guard returns `false` instead of `void`.
**When to use:** `lib/cache/helpers.ts` — the single change that the four fetchers + cron thread through.
**Example:**
```typescript
export async function cacheSet<T>(
  key: string,
  data: T,
  options?: { allowEmpty?: boolean },
): Promise<boolean> {
  if (Array.isArray(data) && data.length === 0 && !options?.allowEmpty) {
    console.warn(`[cache] skipping empty write to "${key}" (pass allowEmpty to override)`);
    return false;
  }
  const redis = getRedis();
  await redis.set(key, { data, fetchedAt: new Date().toISOString() }, { ex: SAFETY_TTL_SECONDS });
  return true;
}
```

### Pattern 4: YouTube empty-path surfacing (P1)
The `youtube.ts:48-50` early `return []` happens *before* `cacheSet` is ever called, so `cacheSet` returning a boolean is **not sufficient** for YouTube — there is no `cacheSet` call on that path. Two mechanisms (planner's choice, CONTEXT discretion):
- **(a) Structured fetcher return** — change `fetchYouTubeVideos` to return `{ data: Video[], wrote: boolean }`; on the early-return path, return `{ data: [], wrote: false }`; on the success path, return `{ data: videos, wrote: <cacheSet result> }`. Apply the same shape to reddit/twitter/news for consistency.
- **(b) Cron re-derivation** — leave fetchers returning `T[]`; the cron infers `skipped_empty` from `(fetcher fulfilled) && (returned array is empty)`. Simpler diff, but couples the cron to the empty-array convention.
Recommendation: **(a)** has the smallest *semantic* blast radius (the rule lives with the fetcher, not duplicated in the cron) even though it touches 4 files; **(b)** touches only `route.ts`. Either is locked-compliant. Lean (b) if minimizing files; lean (a) if the planner wants the YouTube path to be self-documenting.

### Anti-Patterns to Avoid
- **Composing atomicity from multiple REST calls** — `get` then `set`/`incrby`/`del` over the Upstash REST transport is NOT atomic (no MULTI/EXEC over REST). This is the P3 bug. Use a single flagged command or `eval`.
- **Returning a 5xx on lock contention** — QStash retries 5xx, which re-contends the lock forever. Contended → HTTP **200**.
- **`ttl <= maxDuration`** — if the lock ttl is ≤ 60 and a run takes the full 60s, the lock can expire mid-run and a retry races in. ttl **must** be 90 (strictly > 60).
- **Relying on Lua `true`/`false` → JS boolean** — Redis has no boolean reply; Lua `false` becomes `null`, `true` becomes `1`. Return explicit integers.
- **Forgetting `tonumber()` in Lua** — `ARGV` values are strings; `"5" + "3"` is a Lua error or wrong result. Wrap every numeric ARGV.
- **Removing the empty-array guard** — P1 makes the skip *visible*, it does NOT remove the guard. The guard still skips empty writes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compare-and-delete (lock release) | A `get` + JS `if` + `del` sequence | `redis.eval` with the Redlock release script | The `get`/`del` gap is a race window; `eval` is server-side atomic |
| Check-then-increment (budget) | `redis.get` + conditional `redis.incrby` | `redis.eval` Lua OR `incrby`-first-refund | This is literally the P3 bug being fixed |
| Distributed mutex | A "is-running" flag with separate read/write | `SET key val NX EX ttl` (one command) | NX makes acquire atomic; EX makes it self-healing |
| Multi-command transaction over REST | Trying to find a MULTI/EXEC API | `eval` (Lua) | Upstash REST has no transaction; Lua is the atomicity primitive |

**Key insight:** Over the Upstash REST transport, "atomic" means **exactly one of: a single command, or a single `eval`.** Anything composed from two awaits has a race window. Every P2/P3 correctness requirement reduces to picking the right single-operation primitive.

## Runtime State Inventory

> Phase 3 is a refactor/hardening phase touching Redis runtime state. Inventory below.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New Redis key `cron:refresh:lock` (P2) — ephemeral, 90s ttl, no migration. Existing `sentiment:budget:<UTC-date>` keys (P3) — the *format* and reset semantics are unchanged; only the *write path* (now atomic) changes. No existing data needs migrating. | Code edit only. No data migration. The P3 change is write-path-only — existing budget counters keep working. |
| Live service config | **Upstash QStash schedule** — points at the develop-branch alias `…?x-vercel-protection-bypass=<secret>`. P2 changes the route's *response* for contended calls (now 200 `{status:"locked"}` instead of running). QStash treats 200 as success → no retry storm. No schedule reconfiguration needed. P4 removes the **Vercel** `crons` entry — that is `vercel.json`, in git, not a live-service-only config. | None for QStash. P4's `vercel.json` edit is a git change. |
| OS-registered state | None — no OS-level task registration; cron is QStash + Vercel only. | None — verified via `vercel.json` (the only cron config) and CLAUDE.md Deployment section. |
| Secrets/env vars | `SENTIMENT_DAILY_CHAR_BUDGET` (read by `checkAndConsumeBudget`) — P3 preserves the env var name and default (`200_000`). No new env vars. No secret renames. | None — verified by reading `lib/api/sentiment.ts` and `.env.example` references in CLAUDE.md. |
| Build artifacts | None — no compiled packages, no egg-info equivalents. `vercel.json` change takes effect on next deploy (Vercel reads it at build time). | Redeploy picks up `vercel.json` change automatically — standard. |

**The canonical question — after every repo file is updated, what runtime state still has the old behavior?** Only the QStash schedule keeps firing on its 15-min cadence (unchanged — that's correct), and the *Vercel* daily cron stops appearing after the next deploy. No stale cached strings, no registered OS state. The one subtle item: a `cron:refresh:lock` key could be left in Redis if a run is hard-killed *before* the `finally` release — but that is by-design (the 90s EX ttl self-heals it). No manual cleanup task needed.

## Code Shape (verified — current tree, exact line numbers)

> Read before planning. Line numbers from the current `feature/reddit-free-fallback` branch.

### `lib/cache/helpers.ts` (43 lines)
- `cacheGet<T>(key, maxAgeMs)` — lines 6–21. Not modified by this phase.
- **`cacheSet<T>(key, data, options?: { allowEmpty?: boolean }): Promise<void>`** — lines 23–42. **P1 changes the return type to `Promise<boolean>`.**
  - Empty-array guard: lines 29–34 — `if (Array.isArray(data) && data.length === 0 && !options?.allowEmpty)` → `console.warn` + `return`. **P1: this returns `false`.**
  - The actual write: lines 36–41 — `redis.set(key, wrapped, { ex: SAFETY_TTL_SECONDS })`. **P1: after this, `return true`.**
  - `SAFETY_TTL_SECONDS = 86400` — line 4.

### `lib/cache/redis.ts` (13 lines)
- `getRedis(): Redis` — lazy-init singleton, lines 5–13. Unchanged. All P2/P3 ops go through this.

### `app/api/cron/refresh/route.ts` (179 lines)
- `export const maxDuration = 60` — **line 6**. The P2 lock ttl (90) must exceed this.
- `export const dynamic = "force-dynamic"` — line 5.
- `captureIfSentry(err, label)` — lines 18–23. Reusable Sentry+console helper.
- **`refreshAllFeeds()`** — lines 25–134. P2 wraps this body in the lock; P1 rewrites the `summary` plumbing.
  - `summary` object — lines 26–35, typed `Record<string, "ok" | "failed">`, 8 keys (youtube, reddit, twitter, news, trending, hero, alerts, sentiment), all init `"failed"`. **P1: retype to the three-state union.**
  - Tier 1 `Promise.allSettled` — lines 38–44 (`fetchYouTubeVideos`, `fetchRedditPosts`, `fetchTweets`, `fetchNews`).
  - Tier 1 result handling — lines 46–75: each `if (xResult.status === "fulfilled")` sets `summary.x = "ok"`. **P1: this is where the three-state derivation goes.**
  - Tier 2 trending — lines 77–86.
  - Tier 3 (hero ‖ alerts ‖ sentiment) `Promise.allSettled` — lines 105–127.
  - Final response — lines 129–133: `NextResponse.json({ status: "ok", refreshedAt, summary })`.
- **`GET(request)`** — lines 137–151. Verifies `Authorization: Bearer ${CRON_SECRET}` (lines 144–148), then `return refreshAllFeeds()` (line 150).
- **`POST(request)`** — lines 155–179. Verifies QStash signature via `Receiver.verify({ signature, body })` (lines 163–176), then `return refreshAllFeeds()` (line 178). **The lock must be inside `refreshAllFeeds()` so both handlers are covered — confirmed both call it.**

### `lib/api/youtube.ts` (107 lines)
- `fetchYouTubeVideos(): Promise<Video[]>` — lines 6–107.
- **The blind-spot early return — lines 48–50:** `if (videoIds.length === 0) { return []; }` — happens *before* `cacheSet` (line 104). CLAUDE.md/CONTEXT call this `:41-43`; in the current tree it is **`:48-50`** (the line drifted; planner should target the actual `if (videoIds.length === 0)` block, not a hardcoded line range).
- There is also a `return []` at lines 7–10 (no `YOUTUBE_API_KEY`) — same blind-spot class, also pre-`cacheSet`.
- `await cacheSet(CACHE_KEYS.youtube, videos)` — **line 104**, only reached on the success path.

### `lib/api/reddit.ts` (123 lines)
- `fetchRedditPosts(): Promise<RedditPost[]>` — lines 106–123. `await cacheSet(CACHE_KEYS.reddit, posts)` — **line 120**. `posts` can be `[]` if every subreddit fails → guard skips silently today.

### `lib/api/twitter.ts` (101 lines)
- `fetchTweets(): Promise<Tweet[]>` — lines 28–101. Early `return []` if no `X_BEARER_TOKEN` — lines 29–33 (pre-`cacheSet` blind spot, same class as YouTube). `await cacheSet(CACHE_KEYS.twitter, allTweets)` — **line 98**.

### `lib/api/news.ts` (52 lines)
- `fetchNews(): Promise<NewsItem[]>` — lines 19–52. `await cacheSet(CACHE_KEYS.news, top)` — **line 49**. `top` is `items.slice(0, 30)`; can be `[]` if all feeds fail.

### `lib/api/sentiment.ts` (216 lines)
- **`checkAndConsumeBudget(charsNeeded: number): Promise<boolean>`** — **lines 76–85**. This is the P3 target.
  - `budget` from `process.env.SENTIMENT_DAILY_CHAR_BUDGET` — line 77, default `DEFAULT_BUDGET = 200_000` (line 9).
  - `key = todayKey()` — line 78.
  - **The non-atomic bug — lines 80–83:** `const current = (await redis.get<number>(key)) ?? 0;` → `if (current + charsNeeded > budget) return false;` → `await redis.incrby(key, charsNeeded);` → `await redis.expire(key, BUDGET_EXPIRE_SECONDS);`. Three separate awaits — the gap between `get` and `incrby` is the double-spend window.
- `todayKey()` — lines 68–74. UTC-date key: `sentiment:budget:${y}-${m}-${d}`. **P3 must preserve this format and the reset semantics.**
- `BUDGET_EXPIRE_SECONDS = 86_400 * 2` — line 12 (48h, so day-boundary edge cases survive). **P3 must preserve the expire.**
- `checkAndConsumeBudget` is called once — line 143: `if (!(await checkAndConsumeBudget(totalChars))) { throw new Error("[sentiment] daily char budget tripped"); }`.
- **401 Sentry capture — lines 175–194** — `Sentry.captureException(..., { tags: { component: "sentiment", reason: "key-rotation-suspected" } })`. **Regression guard: P3 must NOT touch or regress this.**
- `cacheSet(CACHE_KEYS.sentiment, ...)` calls — lines 138 (empty path) and 205 (success path). `Sentiment` is object-shaped, so the empty-array guard does NOT fire here (Finding 7 — out of scope).

### `lib/constants.ts` (58 lines)
- **`CACHE_KEYS`** — lines 38–48, an `as const` object: youtube, reddit, twitter, trending, news, sentiment, trendingRanked, hero, spikes. **P2 adds the cron-lock key here** (e.g. `cronLock: "cron:refresh:lock"`).
- `CACHE_MAX_AGE` — lines 50–54. The lock ttl (90s) is a *Redis EX value in seconds*, conceptually distinct from these `*MaxAge` ms values — planner may add it as a separate constant or inline; CONTEXT only mandates the *key* go in `CACHE_KEYS`.

### `vercel.json` (8 lines)
```json
{
  "crons": [
    { "path": "/api/cron/refresh", "schedule": "0 0 * * *" }
  ]
}
```
- **P4: remove the `crons` entry.** Vercel's `vercel.json` schema permits an empty file `{}` or an empty `"crons": []`. `[VERIFIED: Vercel crons schema — crons is an optional top-level array]`. Cleanest is `{}` (a valid, non-empty JSON object) or omit the key. Verify with `grep -A3 '"crons"' vercel.json` returning nothing (per CONTEXT acceptance signal).

## Common Pitfalls

### Pitfall 1: Lock release race after ttl expiry
**What goes wrong:** Run A acquires the lock, runs >90s (or hard-killed but somehow the function body keeps going), the lock EX-expires, Run B acquires a *fresh* lock with a *different* value, then Run A's `finally` block does an unconditional `del` — deleting Run B's lock.
**Why it happens:** Unconditional `del` doesn't check ownership.
**How to avoid:** Value-checked release via the Lua `eval` script (delete only if `get == ARGV[1]`). CONTEXT explicitly allows accepting the race instead (rely on the short ttl) — but if so, *document the trade-off in a code comment* (CONTEXT mandates this).
**Warning signs:** Two cron runs both executing tiers despite the lock; ZSET double-writes.

### Pitfall 2: Lua ARGV string coercion
**What goes wrong:** `current + needed` in Lua where `needed = ARGV[1]` — string concatenation or a runtime error, budget check silently wrong.
**Why it happens:** Redis passes all ARGV as strings.
**How to avoid:** `tonumber(ARGV[n])` for every numeric argument inside the script.
**Warning signs:** Budget never trips, or trips immediately; test the Lua path with concrete numbers.

### Pitfall 3: `ttl <= maxDuration` deadlock-ish window
**What goes wrong:** Lock ttl 60 = maxDuration 60. A run that takes the full 60s has its lock expire at the same moment; a QStash retry fired at second 61 acquires and races.
**Why it happens:** No safety margin.
**How to avoid:** ttl = 90, strictly > 60. CONTEXT locks this.
**Warning signs:** Concurrent runs under load despite the lock.

### Pitfall 4: Treating `redis.set(..., {nx:true})` return as a boolean
**What goes wrong:** `if (await redis.set(...))` — works by accident (`"OK"` is truthy, `null` is falsy) but `=== true` fails.
**How to avoid:** Compare `=== "OK"` or `!== null` explicitly. Don't annotate it as `boolean`.

### Pitfall 5: P1 mechanism touches 4 fetchers but the YouTube path has no cacheSet call
**What goes wrong:** Planner makes `cacheSet` return a boolean and assumes that covers YouTube — but `youtube.ts:48-50` returns before `cacheSet` is ever invoked, so there is no boolean to thread.
**How to avoid:** YouTube needs *either* a structured fetcher return *or* cron-side `(fulfilled && empty)` re-derivation — see Architecture Pattern 4. The `cacheSet` boolean alone is necessary but not sufficient for the YouTube criterion.
**Warning signs:** The acceptance test "all four upstreams return `[]` → YouTube shows `skipped_empty`" fails for YouTube specifically.

### Pitfall 6: Forgetting the lock covers BOTH transports
**What goes wrong:** Lock added in the `GET` handler only; QStash `POST` (the *only* path that actually refreshes under Deployment Protection per CLAUDE.md) is unprotected.
**How to avoid:** Lock inside `refreshAllFeeds()` (lines 25–134), not in the handlers. Both `GET` (line 150) and `POST` (line 178) call it.

## Code Examples

### Vitest — boundary-mock the Redis client (established pattern)
```typescript
// Source: lib/cache/timeseries.test.ts (verified, current tree) — the canonical pattern
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedis } from "@/lib/cache/redis";

vi.mock("@/lib/cache/redis", () => ({ getRedis: vi.fn() }));

const mockRedis = {
  set: vi.fn(),
  eval: vi.fn(),
  del: vi.fn(),
  get: vi.fn(),
  incrby: vi.fn(),
  expire: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getRedis).mockReturnValue(mockRedis as any);
});
```

### P2 lock helper test cases (the locked acquire/contend/release trio)
```typescript
// acquire-success: set returns "OK"
mockRedis.set.mockResolvedValueOnce("OK");
expect(await acquireLock()).toBe(true /* or the lock value */);

// acquire-contended: set with nx returns null
mockRedis.set.mockResolvedValueOnce(null);
expect(await acquireLock()).toBe(false /* or null */);

// release: value-checked eval is called with the lock key + our value
await releaseLock(lockValue);
expect(mockRedis.eval).toHaveBeenCalledWith(
  expect.stringContaining("del"),
  [CACHE_KEYS.cronLock],
  [lockValue],
);
```

### P3 atomic budget test cases
```typescript
// Lua-eval mechanism: mock eval's integer sentinel return
mockRedis.eval.mockResolvedValueOnce(1); // consumed
expect(await checkAndConsumeBudget(100)).toBe(true);
mockRedis.eval.mockResolvedValueOnce(0); // rejected
expect(await checkAndConsumeBudget(100)).toBe(false);

// incr-first-refund mechanism: second concurrent consumer sees inflated counter
mockRedis.incrby
  .mockResolvedValueOnce(199_000)  // consumer A: under 200k budget → passes
  .mockResolvedValueOnce(398_000)  // consumer B: over budget
  .mockResolvedValueOnce(199_000); // consumer B's refund
expect(await checkAndConsumeBudget(199_000)).toBe(true);
expect(await checkAndConsumeBudget(199_000)).toBe(false);
```

### cacheSet boolean contract test
```typescript
expect(await cacheSet("k", [{ x: 1 }])).toBe(true);   // real write
expect(await cacheSet("k", [])).toBe(false);          // empty-array guard skip
expect(await cacheSet("k", [], { allowEmpty: true })).toBe(true); // override
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `redis.get` + `redis.incrby` for budget | `redis.eval` Lua or `incrby`-first-refund | Phase 3 (this phase) | Removes the double-spend race |
| Binary `summary: "ok"/"failed"` | Three-state `written`/`skipped_empty`/`fetcher_threw` | Phase 3 | Cron observability becomes honest |
| No cron concurrency control | `SET NX EX 90` lock around `refreshAllFeeds()` | Phase 3 | QStash retries can't race tiers |
| Vercel `crons` daily entry (false-green) | QStash-only refresh path | Phase 3 | Removes misleading cron-dashboard signal |

**Deprecated/outdated:**
- The Vercel daily `crons` entry in `vercel.json` — 401s at the edge under Deployment Protection, never reaches the route. Removed by P4.
- The `:41-43` line reference in CLAUDE.md / CONTEXT for the YouTube blind spot — the actual current line is `:48-50`. The planner should target the `if (videoIds.length === 0)` block by content, and update the CLAUDE.md note after P1 lands.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `redis.set(key, val, { nx: true, ex: 90 })` returns `"OK"` on acquire and `null` on contention in `@upstash/redis` v1.37.0 specifically | Standard Stack | LOW — confirmed by official docs (Python `set(..., nx=True) == False` for contention; JS returns `"OK"`/`null`) and Redis protocol; the JS-vs-Python return-value naming differs but the truthy/falsy split is stable. Planner should still branch on `=== "OK"` / `!== null` rather than `=== true`, which is robust either way. |
| A2 | `vercel.json` accepts an empty `{}` or omitted `crons` key without a schema error | Code Shape §vercel.json | LOW — `crons` is documented as an optional top-level array; an empty object is valid JSON. If a deploy ever complains, fall back to `"crons": []`. |
| A3 | Lua `eval` over Upstash REST coerces `return 1`/`return 0` to JS `1`/`0` numbers | Standard Stack §eval | LOW — standard Redis reply coercion (integer reply → number). The Code Examples branch on `=== 1`, which is the safe form. |

## Open Questions

1. **P1 mechanism choice — structured fetcher return vs cron re-derivation.**
   - What we know: both are locked-compliant; CONTEXT explicitly leaves it to the planner ("Pick the mechanism with the smallest blast radius").
   - What's unclear: whether the planner prioritizes fewest-files-touched (re-derivation, `route.ts` only) or self-documenting fetchers (structured return, 4 files).
   - Recommendation: re-derivation `(fulfilled && returned array empty) → skipped_empty` for the smallest diff; it satisfies every acceptance signal including the YouTube path. Note it in the plan as a deliberate trade-off.

2. **P2 — extract `lib/cache/lock.ts` helper or inline in `route.ts`?**
   - What we know: single call site → inline is allowed; the locked test requirement ("a unit test covers acquire-success, acquire-contended, release") is *much* easier against an extracted helper that can be boundary-mocked like `timeseries.ts`.
   - Recommendation: extract a small `lib/cache/lock.ts` (`acquireLock()` / `releaseLock(value)`), purely so the test can target it cleanly. This is the lower-friction path to the locked test coverage.

3. **P3 — Lua `eval` vs `incrby`-first-refund.**
   - What we know: both satisfy the contract; CONTEXT leaves it open.
   - Recommendation: Lua `eval` — it is genuinely atomic in one round trip, the refund approach has a (cosmetic but real) transient over-report. The Lua string is ~6 lines and well-precedented. If the planner wants zero Lua strings in the codebase, the refund approach is the documented fallback.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@upstash/redis` | P1/P2/P3 Redis ops | ✓ | 1.37.0 | — |
| `vitest` + `@vitest/coverage-v8` | SC-5 tests | ✓ | 4.1.5 | — |
| Upstash Redis instance (runtime) | P2 lock, P3 budget — *runtime only* | n/a at plan time | — | Tests mock Redis at the `getRedis()` boundary — no live instance needed for `npm test` |
| TypeScript / ESLint | `tsc --noEmit`, `npm run lint` | ✓ | tsc ^5, eslint ^8 | — |

**Missing dependencies with no fallback:** None — Phase 3 adds no new packages.
**Missing dependencies with fallback:** None — all unit tests run fully mocked; no live Upstash instance required for the locked test gate.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (`environment: "node"`) |
| Config file | `vitest.config.ts` (verified — `include: ["**/*.test.ts"]`, `@` alias → project root, `passWithNoTests: true`) |
| Quick run command | `npx vitest run <path>` (single file) |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | `cacheSet([item])` → `true`; `cacheSet([])` → `false`; `allowEmpty` override → `true` | unit | `npx vitest run lib/cache/helpers.test.ts` | ❌ Wave 0 — new file |
| SC-1 | Cron summary: all-empty Tier-1 run produces zero `written` entries; YouTube empty path → `skipped_empty` | unit | `npx vitest run app/api/cron/refresh/route.test.ts` (if route is testable) OR assert via the fetcher-return mechanism | ❌ Wave 0 — new file (route handler test is the harder one; see Wave 0 Gaps) |
| SC-2 | Lock acquire-success (`set`→`"OK"`), acquire-contended (`set`→`null`), release (value-checked `eval`) | unit | `npx vitest run lib/cache/lock.test.ts` | ❌ Wave 0 — new file (pairs with extracted `lib/cache/lock.ts`) |
| SC-3 | Atomic budget: single consumer under budget passes; second concurrent consumer rejected; total ≤ `SENTIMENT_DAILY_CHAR_BUDGET` | unit | `npx vitest run lib/api/sentiment.test.ts` | ✅ exists — extend with `checkAndConsumeBudget` cases (currently it only tests `preprocessText`/`aggregateSentiment`/`fetchAndCacheSentiment` missing-key) |
| SC-4 | `vercel.json` has no `crons` entry | check (non-Vitest) | `grep -A3 '"crons"' vercel.json` returns nothing | n/a — grep assertion, not a unit test |
| SC-5 | Whole suite green; types + lint clean | suite | `npm test && npx tsc --noEmit && npm run lint` | n/a — gate |

### Sampling Rate
- **Per task commit:** `npx vitest run <the file(s) that task touched>` — sub-second feedback.
- **Per wave merge:** `npm test` (full Vitest suite — currently 58+ tests, all must stay green).
- **Phase gate:** `npm test && npx tsc --noEmit && npm run lint` all clean before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `lib/cache/helpers.test.ts` — covers SC-1 `cacheSet` boolean contract. New file. Mock `getRedis()` at the boundary (`set` mock).
- [ ] `lib/cache/lock.test.ts` — covers SC-2 acquire/contend/release. New file. Pairs with extracting `lib/cache/lock.ts` (see Open Question 2). Mock `getRedis()` — `set` and `eval` mocks.
- [ ] `lib/cache/lock.ts` — the lock helper itself (recommended extraction, not strictly mandated — inline in `route.ts` is allowed but harder to test).
- [ ] **Cron summary test (SC-1, the route-level half)** — there is currently **no test for `app/api/cron/refresh/route.ts`** and no precedent in the repo for testing a Next.js route handler under Vitest. This is the one genuine test-infra gap. Options for the planner: (a) if P1 uses structured fetcher returns, the three-state derivation can be a pure helper function that *is* unit-testable without invoking the route; (b) test each fetcher's empty-vs-written signal in isolation. Recommendation: structure P1 so the summary-derivation logic is a pure function, then SC-1's cron half is a normal Vitest unit test. Avoid trying to invoke the `GET`/`POST` handlers directly.
- [ ] `lib/api/sentiment.test.ts` — **exists**; extend (not create) with `checkAndConsumeBudget` cases. Currently mocks nothing — the new cases need `vi.mock("@/lib/cache/redis")` added.

*(Framework install: not needed — Vitest 4.1.5 already bootstrapped in Phase 1.)*

## Sources

### Primary (HIGH confidence)
- `node_modules/@upstash/redis/package.json` — confirmed installed version **1.37.0** (via `node -e require(...).version`).
- `package.json` / `vitest.config.ts` — confirmed `vitest` 4.1.5, `environment: "node"`, `@` alias.
- Direct reads of current-tree source: `lib/cache/helpers.ts`, `lib/cache/redis.ts`, `app/api/cron/refresh/route.ts`, `lib/api/youtube.ts`, `lib/api/reddit.ts`, `lib/api/twitter.ts`, `lib/api/news.ts`, `lib/api/sentiment.ts`, `lib/constants.ts`, `vercel.json`, `lib/cache/timeseries.test.ts`, `lib/api/sentiment.test.ts`, `lib/api/alerts.test.ts` — all line numbers in Code Shape verified against these.
- `.planning/phases/03-caching-refresh-hardening/03-CONTEXT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `CLAUDE.md` — locked decisions and constraints.
- Context7 `/websites/upstash_redis` (via `ctx7` CLI) — `SET` command options (`nx`, `ex`, combinable; return `"OK"` / old value / `null`); `EVAL` signature `redis.eval(script, keys, args)` with the official `return ARGV[1]` example.

### Secondary (MEDIUM confidence)
- WebSearch — `@upstash/redis` `set` with `nx`+`ex` combinable; confirmed against Upstash blog + npm; the `"OK"`/`null` return split cross-verified with Redis protocol semantics (SET NX returns OK bulk-string or nil).

### Tertiary (LOW confidence)
- None — all critical claims verified against installed code, official docs, or the project's own source tree.

## Metadata

**Confidence breakdown:**
- `@upstash/redis` API surface (set/eval/del): HIGH — official Upstash docs + installed version pinned; one minor naming nuance (JS `"OK"`/`null` vs Python `True`/`False`) flagged in Assumptions Log A1 with a robust mitigation (branch on `=== "OK"`).
- Current code shape / line numbers: HIGH — every line number read directly from the current tree.
- Architecture patterns (lock, atomic budget): HIGH — standard, well-precedented Redis patterns; the Lua release script is the canonical Redlock script.
- Test mocking pattern: HIGH — copied from the project's own verified `timeseries.test.ts` / `alerts.test.ts`.
- The one acknowledged gap: no precedent for route-handler testing in this repo (SC-1's cron half) — flagged in Wave 0 Gaps with a concrete recommendation (extract a pure summary-derivation function).

**Research date:** 2026-05-13
**Valid until:** 2026-06-12 (30 days — `@upstash/redis` is stable at 1.37.0; the codebase is the moving part, and line numbers should be re-verified if other branches merge before planning).
