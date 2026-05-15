# Plan 03-01 Summary: Truthful cacheSet + cron summary

## What changed

### Task 1 — `cacheSet` returns a write boolean
- `lib/cache/helpers.ts`: `cacheSet` return type changed `Promise<void>` → `Promise<boolean>`. Empty-array guard branch returns `false` (warn line unchanged); `return true` added after `redis.set`. Guard logic untouched. `cacheGet` untouched.
- `lib/cache/helpers.test.ts` (new): 4 tests covering non-empty array (`true` + write), empty array (`false` + no write), empty array with `allowEmpty` (`true` + write), non-array object (`true` + write).

### Task 2 — pure `deriveSourceOutcome` helper
- `lib/cron/summary.ts` (new): exports `SourceOutcome` union (`"written" | "skipped_empty" | "fetcher_threw"`) and pure `deriveSourceOutcome(result: PromiseSettledResult<unknown[]>)`. No Redis imports. Comment explains why re-derivation lives in the cron (YouTube's pre-`cacheSet` early `return []` blind spots).
- `lib/cron/summary.test.ts` (new): 3 tests covering rejected → `fetcher_threw`, fulfilled empty → `skipped_empty`, fulfilled non-empty → `written`.

### Task 3 — thread three-state outcome into cron + CLAUDE.md
- `app/api/cron/refresh/route.ts`: imports `deriveSourceOutcome` + `SourceOutcome`. `summary` retyped to `Record<string, SourceOutcome | "ok" | "failed">`; four Tier 1 keys init to `"fetcher_threw"`. Tier 1 result handling now sets each key via `deriveSourceOutcome(...)`; `captureIfSentry` calls preserved on rejected branches; `videos`/`posts`/`tweets` assignments preserved. Tier 2/3 blocks, GET/POST handlers, `maxDuration`, `Promise.allSettled` structure untouched.
- `CLAUDE.md`: "Cron summary truthfulness" and "YouTube cache-skip blind spot" Key Patterns bullets rewritten for the new three-state contract.

## Test results
- `npx vitest run lib/cache/helpers.test.ts` — 4 passed
- `npx vitest run lib/cron/summary.test.ts` — 3 passed
- `npx tsc --noEmit` — exit 0
- `npm run lint` — no warnings or errors
- `npm test` — 9 files, 65 tests passed

## Deviations
None. The `summary.news` rejected-branch check was rewritten as `if (newsResult.status === "rejected")` (news has no `value` variable to assign), functionally identical to the prior `else` after the assignment was moved to `deriveSourceOutcome`.
