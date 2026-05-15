# Plan 03-03 Summary — Atomic sentiment budget

## What changed

Replaced the non-atomic daily-budget check-and-consume in `lib/api/sentiment.ts`
with a single atomic `redis.eval` Lua operation, closing the get→incrby
double-spend window (two concurrent runs could both pass the guard and together
exceed `SENTIMENT_DAILY_CHAR_BUDGET`).

### `lib/api/sentiment.ts`
- `checkAndConsumeBudget` is now `export`ed (for direct unit testing).
- Added module-level `CONSUME_BUDGET_SCRIPT` Lua string: reads the key,
  `tonumber()`s every numeric ARGV, rejects with `return 0` when over budget,
  otherwise `incrby` + `expire` and `return 1`.
- `checkAndConsumeBudget` body rewritten to a single
  `redis.eval(CONSUME_BUDGET_SCRIPT, [key], [charsNeeded, budget, BUDGET_EXPIRE_SECONDS])`
  call, returning `result === 1`. No remaining `redis.get` + conditional
  `redis.incrby` pair.
- Untouched: `todayKey()`, `BUDGET_EXPIRE_SECONDS`, `DEFAULT_BUDGET`, the
  `SENTIMENT_DAILY_CHAR_BUDGET` env read, the single call site, and the 401
  Sentry capture (`reason: "key-rotation-suspected"`).

### `lib/api/sentiment.test.ts`
- Added Redis boundary-mock block (`vi.mock("@/lib/cache/redis")`, `mockRedis`
  with `eval`/`get`/`incrby`/`expire`, `beforeEach` wiring) following the
  `timeseries.test.ts` pattern.
- Imports `checkAndConsumeBudget` directly and tests its true/false contract:
  single under-budget consumer passes (`eval` → 1), rejected consumer fails
  (`eval` → 0), and two concurrent consumers near the limit
  (`mockResolvedValueOnce(1)` then `(0)`) — only the first passes.
- Existing `preprocessText` / `aggregateSentiment` / `fetchAndCacheSentiment`
  tests left unchanged.

## Test results

- Task 1 (RED): `npx tsc --noEmit` exit 0; `npx vitest run lib/api/sentiment.test.ts`
  — 2 failed / 10 passed, as expected (concurrent + reject tests RED against
  the still-non-atomic implementation).
- Task 2 (GREEN): `npx tsc --noEmit` exit 0; `npm run lint` exit 0;
  `npx vitest run lib/api/sentiment.test.ts` — 12 passed.

## Deviations

None.
