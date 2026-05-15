# Phase 3: Caching & Refresh Hardening - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 14 (1 new helper + 3 new tests + 10 modified)
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/cache/lock.ts` (NEW) | utility (cache helper) | request-response (Redis round trip) | `lib/cache/timeseries.ts` | role-match (Redis-wrapper sibling) |
| `lib/cache/lock.test.ts` (NEW) | test | — | `lib/cache/timeseries.test.ts` | exact |
| `lib/cache/helpers.test.ts` (NEW) | test | — | `lib/cache/timeseries.test.ts` | exact |
| `lib/api/sentiment.test.ts` (MODIFIED — extend) | test | — | `lib/api/alerts.test.ts` | exact (boundary-mock Redis) |
| `lib/cache/helpers.ts` (MODIFIED) | utility (cache helper) | request-response | `lib/cache/timeseries.ts` (sibling); self | exact (in-place return-type change) |
| `app/api/cron/refresh/route.ts` (MODIFIED) | route (API handler) | batch / event-driven (3-tier DAG) | self (in-place) | exact |
| `lib/api/youtube.ts` (MODIFIED) | service (API client / fetcher) | transform → CRUD (cacheSet) | `lib/api/reddit.ts` / `news.ts` | exact (sibling fetchers) |
| `lib/api/reddit.ts` (MODIFIED) | service (fetcher) | transform → CRUD | `lib/api/news.ts` | exact |
| `lib/api/twitter.ts` (MODIFIED) | service (fetcher) | transform → CRUD | `lib/api/news.ts` | exact |
| `lib/api/news.ts` (MODIFIED) | service (fetcher) | transform → CRUD | `lib/api/reddit.ts` | exact |
| `lib/api/sentiment.ts` (MODIFIED) | service (fetcher + budget guard) | request-response (Redis check-and-consume) | `lib/cache/timeseries.ts` (Redis ops); self | role-match |
| `lib/constants.ts` (MODIFIED) | config | — | self (`CACHE_KEYS` block) | exact |
| `vercel.json` (MODIFIED) | config | — | self | exact |
| `CLAUDE.md` (MODIFIED) | docs | — | self | exact |

## Pattern Assignments

### `lib/cache/lock.ts` (NEW — utility, request-response)

**Analog:** `lib/cache/timeseries.ts` — the established "small module of named functions, each grabs `getRedis()` locally, single-round-trip Redis ops" pattern. Copy this module shape exactly.

**Module shape to copy** (`lib/cache/timeseries.ts:1-13`):
```typescript
import { getRedis } from "@/lib/cache/redis";

const SAFETY_TTL_SECONDS = 86400; // 24h key-level TTL bound on top of slot cap

export async function zaddTimepoint(
  key: string,
  ts: number,
  count: number,
): Promise<void> {
  const redis = getRedis();
  await redis.zadd(key, { score: ts, member: `${ts}:${count}` });
  await redis.expire(key, SAFETY_TTL_SECONDS);
}
```
Apply: module-level `const` for the ttl (here `LOCK_TTL_SECONDS = 90`), `const redis = getRedis()` *inside* each exported function (never top-level — CLAUDE.md lazy-init rule), `async function` with explicit return type.

**Acquire pattern** (from RESEARCH.md Pattern 1, verified `@upstash/redis` 1.37.0):
```typescript
const acquired = await redis.set(CACHE_KEYS.cronLock, lockValue, {
  nx: true,
  ex: 90, // strictly > maxDuration (60) so a hard-killed function self-heals
});
// branch on === "OK" / !== null — NOT === true (Pitfall 4)
return acquired === "OK";
```

**Value-checked release pattern** (RESEARCH.md — canonical Redlock release script; `redis.eval(script, keys, args)` 3-arg signature):
```typescript
await redis.eval(
  `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
  [CACHE_KEYS.cronLock],
  [lockValue],
);
```
Document the release-strategy trade-off in a code comment (CONTEXT mandates this — see `<decisions>` P2 / Claude's Discretion).

---

### `lib/cache/helpers.ts` (MODIFIED — utility, request-response)

**Analog:** self — in-place return-type change. Current shape (`lib/cache/helpers.ts:23-42`):
```typescript
export async function cacheSet<T>(
  key: string,
  data: T,
  options?: { allowEmpty?: boolean },
): Promise<void> {
  if (Array.isArray(data) && data.length === 0 && !options?.allowEmpty) {
    console.warn(
      `[cache] skipping empty write to "${key}" (pass allowEmpty to override)`,
    );
    return;
  }
  const redis = getRedis();
  const wrapped: CachedData<T> = { data, fetchedAt: new Date().toISOString() };
  await redis.set(key, wrapped, { ex: SAFETY_TTL_SECONDS });
}
```

**Change (P1):** `Promise<void>` → `Promise<boolean>`; the guard branch `return;` → `return false;`; after the `redis.set`, add `return true;`. Do NOT remove the guard — P1 makes the skip *visible*, not gone (regression guard). RESEARCH.md Pattern 3 has the exact target shape.

---

### `app/api/cron/refresh/route.ts` (MODIFIED — route, batch DAG)

**Analog:** self. Two distinct edits, both inside `refreshAllFeeds()` (`route.ts:25-134`).

**P1 — three-state summary.** Current binary summary (`route.ts:26-35`):
```typescript
const summary: Record<string, "ok" | "failed"> = {
  youtube: "failed", reddit: "failed", twitter: "failed", news: "failed",
  trending: "failed", hero: "failed", alerts: "failed", sentiment: "failed",
};
```
Current Tier-1 result handling to rework (`route.ts:50-75`) — each `if (xResult.status === "fulfilled") { ...; summary.x = "ok"; }`. Retype to the three-state union (`written` / `skipped_empty` / `fetcher_threw`). The YouTube empty path returns `[]` *before* `cacheSet` is ever called (`youtube.ts:48-50`) — `cacheSet`'s new boolean alone does NOT cover it. RESEARCH.md Open Question 1 recommends cron-side re-derivation: `summary.youtube = ytResult.value.length === 0 ? "skipped_empty" : "written"`. Whichever mechanism the planner picks, structure the derivation as a **pure function** so SC-1's cron half is unit-testable without invoking the route handler (RESEARCH.md Wave 0 Gaps).

**P2 — lock wrap.** Wrap the entire `refreshAllFeeds()` body. Acquire at entry; on contention return `NextResponse.json({ status: "locked" }, { status: 200 })` (200, not 5xx — QStash retries 5xx); `try { ...tiers... } finally { releaseLock(lockValue) }`. The lock lives inside `refreshAllFeeds()` so both `GET` (`route.ts:150`) and `POST` (`route.ts:178`) handlers are covered — confirmed both call it. `maxDuration = 60` is at `route.ts:6`; lock ttl must be 90.

**Sentry-capture pattern to reuse** for any new error paths (`route.ts:18-23`):
```typescript
function captureIfSentry(err: unknown, label: string) {
  console.error(`[cron] ${label} failed:`, err);
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.captureException(err);
}
```

---

### `lib/api/youtube.ts` / `reddit.ts` / `twitter.ts` / `news.ts` (MODIFIED — service fetchers, transform → CRUD)

**Analogs:** each other — all four share the identical tail shape. Reddit (`reddit.ts:106-122`) and News (`news.ts:19-52`) are the cleanest references; Twitter (`twitter.ts:28-101`) and YouTube (`youtube.ts:6-107`) additionally have a pre-`cacheSet` early `return []` (no-API-key / no-IDs blind spot).

**Shared tail pattern — `cacheSet` then return** (`reddit.ts:120-122`):
```typescript
  await cacheSet(CACHE_KEYS.reddit, posts);
  return posts;
}
```
`cacheSet` call sites to thread P1's boolean through: `youtube.ts:104`, `reddit.ts:120`, `twitter.ts:98`, `news.ts:49`.

**Early-return blind spots** (pre-`cacheSet`, never hit the guard):
- `youtube.ts:7-10` (no `YOUTUBE_API_KEY`) and `youtube.ts:48-50` (`if (videoIds.length === 0) return []`)
- `twitter.ts:29-33` (no `X_BEARER_TOKEN`)

**P1 mechanism (Claude's Discretion — pick smallest blast radius):**
- (a) Structured return `{ data, wrote }` from all four fetchers — self-documenting, touches 4 files.
- (b) Cron re-derives from `(fulfilled) && (returned array empty)` — touches only `route.ts`, RESEARCH.md recommended. If (b), these four files may need **zero changes** beyond consuming `cacheSet`'s new boolean return (which is optional — an unused `Promise<boolean>` is still awaitable as before). Planner confirms.

---

### `lib/api/sentiment.ts` (MODIFIED — service, Redis check-and-consume)

**Analog:** `lib/cache/timeseries.ts` for the Redis-op shape; self for the surrounding function. The non-atomic bug, `checkAndConsumeBudget` (`sentiment.ts:76-85`):
```typescript
async function checkAndConsumeBudget(charsNeeded: number): Promise<boolean> {
  const budget = Number(process.env.SENTIMENT_DAILY_CHAR_BUDGET ?? String(DEFAULT_BUDGET));
  const key = todayKey();
  const redis = getRedis();
  const current = (await redis.get<number>(key)) ?? 0;   // ← gap
  if (current + charsNeeded > budget) return false;
  await redis.incrby(key, charsNeeded);                  // ← double-spend window
  await redis.expire(key, BUDGET_EXPIRE_SECONDS);
  return true;
}
```

**P3 — make atomic.** Replace the three-await read-then-write with a single `redis.eval` Lua script (RESEARCH.md Pattern 2 — `tonumber()` every ARGV, `return` integer sentinel `1`/`0` not a Lua boolean, coerce on JS side with `=== 1`) OR the incr-first-refund fallback. Preserve unchanged: `todayKey()` format (`sentiment.ts:68-74`), `BUDGET_EXPIRE_SECONDS = 86_400 * 2` (`sentiment.ts:12`), the `SENTIMENT_DAILY_CHAR_BUDGET` env read + `DEFAULT_BUDGET` default, and the 401 Sentry capture at `sentiment.ts:175-194` (regression guard — do not touch).

---

### `lib/constants.ts` (MODIFIED — config)

**Analog:** self — the `CACHE_KEYS` `as const` block (`constants.ts:38-48`):
```typescript
export const CACHE_KEYS = {
  youtube: "yt:latest",
  reddit: "reddit:hot",
  ...
  spikes: "alerts:spikes",
} as const;
```
**P2:** add one entry, e.g. `cronLock: "cron:refresh:lock"`. The 90s lock ttl is a Redis EX value in seconds — conceptually distinct from the `CACHE_MAX_AGE` ms values (`constants.ts:50-54`); planner may add a separate `const` or inline it. CONTEXT only mandates the *key* go in `CACHE_KEYS`.

---

### `vercel.json` (MODIFIED — config)

**Analog:** self. Current (`vercel.json:1-8`) has a single `crons` entry. **P4:** remove the `crons` array entirely (cleanest: file becomes `{}`) or set `"crons": []`. Acceptance signal: `grep -A3 '"crons"' vercel.json` returns nothing.

---

### `CLAUDE.md` (MODIFIED — docs)

**Analog:** self. **P4:** tighten the "Deployment" / "Deployment Protection" prose — state QStash is the sole working refresh path, explain the Vercel-edge-401 false-green. **P1:** after the fix lands, update the "Cron summary truthfulness" and "YouTube cache-skip blind spot" Key Patterns notes to describe the new three-state contract (they currently describe the *bug*).

## Shared Patterns

### Redis client access (lazy `getRedis()`)
**Source:** `lib/cache/redis.ts:5-13`, used in `lib/cache/timeseries.ts`, `lib/cache/helpers.ts`, `lib/api/sentiment.ts`
**Apply to:** `lib/cache/lock.ts`, `lib/api/sentiment.ts` (P3 eval)
Always `const redis = getRedis();` *inside* the function body — never `new Redis()`, never a top-level/module-scope client. Upstash validates URLs at construction, which breaks `next build`.

### Vitest boundary-mock of Redis
**Source:** `lib/cache/timeseries.test.ts:1-20` (canonical) and `lib/api/alerts.test.ts:1-29`
**Apply to:** `lib/cache/lock.test.ts`, `lib/cache/helpers.test.ts`, `lib/api/sentiment.test.ts` (extend)
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedis } from "@/lib/cache/redis";

vi.mock("@/lib/cache/redis", () => ({ getRedis: vi.fn() }));

const mockRedis = {
  set: vi.fn(), eval: vi.fn(), del: vi.fn(),
  get: vi.fn(), incrby: vi.fn(), expire: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getRedis).mockReturnValue(mockRedis as any);
});
```
Mock surface per file: lock test needs `set` + `eval`; helpers test needs `set`; sentiment test needs `get` + `incrby` + `expire` (or `eval`). `alerts.test.ts` also shows the multi-mock pattern (`vi.mock` a second module) — useful if a test needs to stub `cacheSet` or a sibling.

**Note (RESEARCH.md Wave 0 Gap):** `lib/api/sentiment.test.ts` currently mocks *nothing* — extending it for `checkAndConsumeBudget` requires *adding* the `vi.mock("@/lib/cache/redis")` block above. Existing pure-function tests (`preprocessText`, `aggregateSentiment`) stay untouched.

### `@upstash/redis` 1.37.0 return-value handling
**Source:** RESEARCH.md Standard Stack (verified against installed version)
**Apply to:** `lib/cache/lock.ts`, `lib/api/sentiment.ts`
- `redis.set(key, val, { nx: true, ex: 90 })` → `"OK"` on acquire, `null` on contention. Branch on `=== "OK"` / `!== null`, never `=== true`.
- `redis.eval(script, keys, args)` — 3 positional args, `keys`/`args` required (`[]` if none). Lua `return 1`/`return 0` → JS `1`/`0`; Lua `true`/`false` → `1`/`null`. Return integer sentinels, coerce with `=== 1`.
- Inside Lua: `ARGV` arrive as strings — `tonumber()` every numeric arg before arithmetic.

## No Analog Found

None — every file in scope is either an in-place modification of an existing file or a new file with a direct sibling analog in `lib/cache/`. The one acknowledged infra gap is **route-handler testing** (`app/api/cron/refresh/route.ts` has no test precedent in the repo) — RESEARCH.md Wave 0 Gaps resolves this by recommending P1's summary-derivation logic be extracted as a pure function, which then tests like any other unit (analog: `lib/api/alerts.test.ts` pure-function cases such as `detectSpike`).

## Metadata

**Analog search scope:** `lib/cache/` (helpers, redis, timeseries + tests), `lib/api/` (youtube, reddit, twitter, news, sentiment + tests), `app/api/cron/refresh/`, `lib/constants.ts`, `vercel.json`
**Files scanned:** 14 read in full or targeted ranges
**Pattern extraction date:** 2026-05-13
