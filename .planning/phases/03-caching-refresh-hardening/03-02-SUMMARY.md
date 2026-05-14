# Plan 03-02 Summary — Distributed cron lock

## What changed

- **`lib/constants.ts`**: Added `cronLock: "cron:refresh:lock"` to the `CACHE_KEYS` `as const` object. No TTL constant added to `CACHE_MAX_AGE` — the lock TTL is a Redis `EX` seconds value, conceptually distinct from the millisecond `*MaxAge` values.
- **`lib/cache/lock.ts`** (new): Distributed Redis lock module following the `timeseries.ts` shape (module-level TTL const, `getRedis()` inside each function, explicit return types).
  - `LOCK_TTL_SECONDS = 90` — strictly greater than the cron route's `maxDuration` (60) so a hard-killed function self-heals via EX expiry rather than deadlocking.
  - `acquireLock(): Promise<string | null>` — builds a unique value `${Date.now()}-${randomUUID()}`, calls `redis.set(key, value, { nx: true, ex: 90 })`, returns the value on `=== "OK"`, else `null`. Branches on `=== "OK"` explicitly (never `=== true`).
  - `releaseLock(lockValue): Promise<void>` — runs the canonical Redlock value-checked-delete Lua script via `redis.eval(script, [key], [value])` so a slow Run A whose lock already EX-expired and was re-acquired by Run B cannot delete Run B's lock. Comment documents the trade-off.
- **`lib/cache/lock.test.ts`** (new): 3 tests using the `timeseries.test.ts` boundary-mock pattern — acquire-success (asserts `nx: true`, `ex: 90`), acquire-contended (`null`), release (asserts `eval` called with script containing `del`/`get`, key array, value array).
- **`app/api/cron/refresh/route.ts`**: Imported `acquireLock`/`releaseLock`. Wrapped the entire body of `refreshAllFeeds()` in the lock — `acquireLock()` at the top before any tier; on `null` contention returns `NextResponse.json({ status: "locked" }, { status: 200 })` (HTTP 200 so QStash treats the retry as delivered and stops re-contending); on acquire, the existing 3-tier logic runs inside `try` with `releaseLock(lockValue)` in `finally`. The `finally`'s `releaseLock` call is itself wrapped in `try/catch` (capturing via `captureIfSentry`) so a release-time Redis blip cannot clobber a real tier error as the promise rejection — a failed release is non-fatal (the 90s TTL self-heals). Lock logic lives inside `refreshAllFeeds()` so both `GET` and `POST` are covered without touching the handlers. `maxDuration = 60`, QStash `receiver.verify`, Bearer check, and Plan 03-01's typed `summary` all unchanged.

## Test results

- Task 1: `npx tsc --noEmit` exit 0; `grep -c 'cronLock' lib/constants.ts` → 1
- Task 2: `npx vitest run lib/cache/lock.test.ts` → 1 file, 3 tests passed
- Task 3: `npx tsc --noEmit` exit 0; `npm run lint` → no warnings or errors; `npm test` → 10 files, 73 tests passed

## Known test gap (recorded decision, not a TODO)

The unit tests cover `acquireLock`/`releaseLock` in isolation via the boundary-mock
pattern. The *integration invariants* are NOT unit-tested:

- "contended path runs zero tiers" (acquireLock returns `null` → early return before any `Promise.allSettled`)
- "releaseLock runs on both the normal-completion and throw paths"

Testing these would need a full route harness mocking all 8 fetchers plus the lock
module — heavier than this plan's boundary-mock scope. The `finally` semantics are a
JavaScript language guarantee, so the residual risk is low. Recording this here makes
it an explicit decision rather than a silent omission.

## Deviations

None. Implemented exactly as specified, plus a code-review fix: the `finally`
block's `releaseLock` call is wrapped in `try/catch` (capturing via
`captureIfSentry`) so a release-time Redis blip cannot clobber a real tier error
as the promise rejection.
