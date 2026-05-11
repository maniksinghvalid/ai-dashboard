# Phase 1: SCRUM-38 Implementation - Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 19 (8 new + 11 extended)
**Analogs found:** 17 / 19 (2 net-new patterns)

## File Classification

### New files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `lib/topics.ts` | data (constants/taxonomy) | static | `lib/constants.ts` | role-match (`as const` exports) |
| `lib/api/sentiment.ts` | api-client (vendor + write-cache) | request-response + CRUD | `lib/api/twitter.ts` | exact (fetch + Bearer + `cacheSet`) |
| `lib/api/alerts.ts` | api-client (Redis list writer) | CRUD (LPUSH/LTRIM) | `lib/cache/helpers.ts` | role-match — net-new raw-redis pattern |
| `lib/cache/timeseries.ts` | cache (Redis ZSET wrapper) | CRUD (ZADD/ZRANGEBYSCORE/ZREMRANGEBYRANK) | `lib/cache/helpers.ts` | role-match — net-new ZSET pattern |
| `app/api/sentiment/route.ts` | api-route (read-only cache endpoint) | request-response | `app/api/trending/route.ts` | exact |
| `app/api/hero/route.ts` | api-route (read-only cache endpoint) | request-response | `app/api/trending/route.ts` | exact |
| `vitest.config.ts` | config | static | none (net-new) | no analog — reference `tsconfig.json` `@/*` alias |
| `lib/topics.test.ts` | test (pure function) | static | none (net-new) | no analog — first test file |
| `lib/api/sentiment.test.ts` | test (pure function) | static | none (net-new) | no analog |
| `lib/api/trending.test.ts` | test (pure function) | static | none (net-new) | no analog |
| `lib/api/alerts.test.ts` | test (pure function) | static | none (net-new) | no analog |
| `lib/cache/timeseries.test.ts` | test (pure function) | static | none (net-new) | no analog |

### Extended files

| Extended File | Role | Change Pattern | Anchor (current shape) | Match Quality |
|---------------|------|----------------|------------------------|---------------|
| `lib/api/trending.ts` | api-client (compute + write-cache) | refactor scorer | `lib/api/trending.ts:56-109` (current heuristic) | self-anchor |
| `app/api/cron/refresh/route.ts` | api-route (orchestrator) | refactor single-tier → 3-tier DAG | `app/api/cron/refresh/route.ts:13-90` | self-anchor |
| `lib/hooks/use-dashboard.ts` | hook | add 2 data legs | `lib/hooks/use-dashboard.ts:12-19` | self-anchor |
| `lib/types.ts` | types | add `Sentiment`, `SpikeAlert`; extend `HeroStory` | `lib/types.ts:44-56` | self-anchor |
| `lib/constants.ts` | constants | add 4 cache keys | `lib/constants.ts:38-44` | self-anchor |
| `components/widgets/SentimentWidget.tsx` | component | placeholder → live data | `components/widgets/NewsWidget.tsx` | exact (sibling widget contract) |
| `components/widgets/HeroStoryCard.tsx` | component | add API-first fallback to existing client derive | `components/widgets/HeroStoryCard.tsx:56-159` | self-anchor |
| `components/DashboardShell.tsx` | component (shell) | pass new data | `components/DashboardShell.tsx:17,49-69` | self-anchor |
| `.env.example` | config | add env vars | `.env.example` (current shape) | self-anchor |
| `CLAUDE.md` | docs | update env + commands | `CLAUDE.md` (Commands + Environment Variables sections) | self-anchor |
| `package.json` | config | add Vitest deps + scripts | `package.json:5-10,11-34` | self-anchor |

---

## Pattern Assignments

### `lib/topics.ts` (data, static taxonomy)

**Analog:** `lib/constants.ts`

**`as const` named-export pattern** (`lib/constants.ts:1-30`):
```typescript
export const YOUTUBE_CHANNELS = [
  { name: "Andrej Karpathy", channelId: "UCXUPKJO5MZQN11PqgIvyuvQ", uploadsPlaylistId: "UUXUPKJO5MZQN11PqgIvyuvQ" },
  // ...
] as const;

export const SUBREDDITS = [
  "MachineLearning",
  "artificial",
  // ...
] as const;
```

**Apply to `lib/topics.ts`:**
- Export `AI_TOPICS: Topic[]` plus the `Topic` type (per D5).
- Per CONTEXT.md decisions D5: `type Topic = { id: string; label: string; aliases: string[]; wordBoundary?: boolean }`.
- Use `as const` if/where it doesn't fight the `Topic[]` annotation; otherwise plain typed array is fine — the constants file mixes both styles.
- Co-locate a small helper (e.g., `matchTopic(text, topic)`) here as pure function so it is trivially unit-testable. Substring match by default, `\b{alias}\b` regex when `wordBoundary: true`.
- Existing `AI_TERMS` inline array in `lib/api/trending.ts:5-14` is the migration source — delete after consumer is migrated.

---

### `lib/api/sentiment.ts` (api-client, vendor fetch + cache write)

**Analog:** `lib/api/twitter.ts`

**Imports pattern** (`lib/api/twitter.ts:1-3`):
```typescript
import type { Tweet } from "@/lib/types";
import { TWITTER_USERS, CACHE_KEYS } from "@/lib/constants";
import { cacheSet } from "@/lib/cache/helpers";
```

**Env guard + early return** (`lib/api/twitter.ts:28-33`):
```typescript
export async function fetchTweets(): Promise<Tweet[]> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    console.warn("[twitter] X_BEARER_TOKEN not set, skipping fetch");
    return [];
  }
  // ...
}
```

**Bearer-token fetch pattern** (`lib/api/twitter.ts:37-50`):
```typescript
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
});

if (!res.ok) {
  console.warn(
    `[twitter] Non-200 response for @${user.handle}: ${res.status} ${res.statusText}`
  );
  return [];
}

const json: XApiResponse = await res.json();
```

**`Promise.allSettled` batching across N users** (`lib/api/twitter.ts:35-92`):
```typescript
const results = await Promise.allSettled(
  TWITTER_USERS.map(async (user) => { /* per-user fetch */ })
);

const allTweets: Tweet[] = [];
for (const result of results) {
  if (result.status === "fulfilled") {
    allTweets.push(...result.value);
  } else {
    console.warn("[twitter] A user fetch rejected:", result.reason);
  }
}
```

**Cache write pattern** (`lib/api/twitter.ts:98`):
```typescript
await cacheSet(CACHE_KEYS.twitter, allTweets);
```

**Apply to `lib/api/sentiment.ts`:**
- Function signature: `fetchAndCacheSentiment(items: { text: string }[]): Promise<Sentiment>` (callers in the cron pass tweets + Reddit titles).
- Env guards: `TOGETHER_API_KEY` (per F1) — if absent, `console.warn` + return early. NEVER reference `HUGGINGFACE_API_TOKEN`.
- Daily char-budget circuit breaker (`SENTIMENT_DAILY_CHAR_BUDGET`, default ~200000) — per F1; implementation hint: read a Redis counter `sentiment:budget:YYYY-MM-DD` via `getRedis().incrby(...)` with daily expiry. Stop before exceeding.
- `preprocessText(text)` per F2: `@username` → literal `@user`, any `http*` URL → literal `http`. Pure function — must be unit-tested per D6.
- POST to Together AI inference endpoint with Bearer auth. Batch size ≤ 100. Implementation detail (Claude's Discretion): use `fetch` or the official client.
- **Sentry 401 visibility** (per CON-key-rotation-observability): when the vendor returns 401, do NOT silently swallow. Log explicitly *and* `Sentry.captureException(...)`. Pattern reference: cron's per-leg Sentry capture (`app/api/cron/refresh/route.ts:38-41`).
- Final write: `cacheSet(CACHE_KEYS.sentiment, sentiment)`.

---

### `lib/api/alerts.ts` (api-client, Redis list writer — net-new raw-redis)

**Analog:** `lib/cache/helpers.ts` (closest — uses `getRedis()` directly). No existing LPUSH/LTRIM pattern in the codebase.

**Lazy-redis usage pattern** (`lib/cache/helpers.ts:1,9-12`):
```typescript
import { getRedis } from "@/lib/cache/redis";
// ...
export async function cacheGet<T>(key: string, maxAgeMs: number) {
  const redis = getRedis();
  const raw = await redis.get<CachedData<T>>(key);
  // ...
}
```

**Apply to `lib/api/alerts.ts`:**
- Per `CON-alerts-spikes-cap`: every `LPUSH alerts:spikes <json>` MUST be immediately followed by `LTRIM alerts:spikes 0 99`. The two calls form an atomic-by-convention pair — keep them adjacent and **always** in this order so `LLEN ≤ 100` invariant holds.
- Use the lazy `getRedis()` import (NEVER `new Redis()` — see `CLAUDE.md` Key Patterns).
- Public API:
  - `writeSpikeAlert(topic: string, velocity: number, baseline: number): Promise<void>` — performs the LPUSH+LTRIM pair, payload is a JSON-stringified `SpikeAlert`.
  - `detectSpike(currentVelocity: number, baselineVelocity24h: number): boolean` — pure function (returns `velocity > 5 * baseline`). MUST be unit-tested per D6.
- Bypass `cacheSet` deliberately — `cacheSet` wraps in `{data, fetchedAt}` which doesn't fit a list. CLAUDE.md / CONTEXT lock this exception: "Use everywhere EXCEPT the alerts list (raw `LPUSH`/`LTRIM`)."
- Suggested write shape:
```typescript
import { getRedis } from "@/lib/cache/redis";
import { CACHE_KEYS } from "@/lib/constants";
import type { SpikeAlert } from "@/lib/types";

export async function writeSpikeAlert(
  topic: string,
  velocity: number,
  baseline: number,
): Promise<void> {
  const redis = getRedis();
  const payload: SpikeAlert = {
    topic, velocity, baseline,
    multiplier: velocity / Math.max(baseline, 1e-9),
    detectedAt: new Date().toISOString(),
  };
  await redis.lpush(CACHE_KEYS.spikes, JSON.stringify(payload));
  await redis.ltrim(CACHE_KEYS.spikes, 0, 99);
}
```

---

### `lib/cache/timeseries.ts` (cache, ZSET wrapper — net-new raw-redis)

**Analog:** `lib/cache/helpers.ts` (closest in role — Redis abstraction module). No existing ZSET pattern in the codebase.

**Lazy-redis + module shape** (`lib/cache/helpers.ts:1-39`):
```typescript
import { getRedis } from "@/lib/cache/redis";
import type { CachedData } from "@/lib/types";

const SAFETY_TTL_SECONDS = 86400; // 24 hours

export async function cacheGet<T>(key: string, maxAgeMs: number) { /* ... */ }
export async function cacheSet<T>(key: string, data: T, options?: { allowEmpty?: boolean }) { /* ... */ }
```

**Apply to `lib/cache/timeseries.ts`:**
- Per `CON-timeseries-api` (locked): export EXACTLY these three functions, no more no less:
  - `zaddTimepoint(key: string, ts: number, count: number): Promise<void>` — `ZADD key {ts} {ts}` (score=ts) is wrong; you want to store the count *as a member or via a separate hash*. The plan-locked design uses `score = timestamp`, `member = JSON-encoded {ts, count}` (or `ts:count` string). Planner: pick the encoding and write it inline; the test file pins the contract.
  - `zrangeWindow(key: string, fromTs: number, toTs: number): Promise<Array<{ ts: number; count: number }>>` — `ZRANGEBYSCORE key fromTs toTs`, decode members back to `{ts, count}`.
  - `capToSlots(key: string, maxEntries: number): Promise<void>` — `ZREMRANGEBYRANK key 0 -(maxEntries+1)` to trim oldest. Cap is **96 slots per (topic, platform)** per D2.
- Use lazy `getRedis()`. NEVER `new Redis()`. Module is the SOLE caller surface for ZSETs — both `lib/api/trending.ts` (writer) and `lib/api/alerts.ts` (24h baseline read) consume this wrapper (per CON-timeseries-api).
- TTL hint: rely on key-level safety TTL (mirror `SAFETY_TTL_SECONDS = 86400`) OR rely on `capToSlots` for bounded growth — planner picks. The constant lives in `lib/cache/helpers.ts:4` for reference.

---

### `app/api/sentiment/route.ts` (api-route, read-only cache endpoint)

**Analog:** `app/api/trending/route.ts` (CONTEXT explicitly names this as the mirror; see Canonical References).

**Full pattern to copy** (`app/api/trending/route.ts:1-23`):
```typescript
import { NextResponse } from "next/server";
import { cacheGet } from "@/lib/cache/helpers";
import { CACHE_KEYS, CACHE_MAX_AGE } from "@/lib/constants";
import type { TrendingTopic } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const cached = await cacheGet<TrendingTopic[]>(CACHE_KEYS.trending, CACHE_MAX_AGE.default);

  if (!cached) {
    return NextResponse.json(
      { data: [], cachedAt: null, stale: false, error: "No data available" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    data: cached.data,
    cachedAt: cached.fetchedAt,
    stale: cached.stale,
  });
}
```

**Apply to `app/api/sentiment/route.ts`:**
- Swap `TrendingTopic[]` → `Sentiment` (singular object — not array; default `[]` in error path becomes `null` since cold-miss returns 503 anyway).
- Swap `CACHE_KEYS.trending` → `CACHE_KEYS.sentiment` (15-min TTL per CONTEXT; add to `lib/constants.ts`).
- Cold-miss returns 503 with no stale fallback (per `REQ-sentiment-engine` acceptance — matches `/api/trending` pattern). v2 deferred a stale fallback.
- Keep `export const dynamic = "force-dynamic"`.

---

### `app/api/hero/route.ts` (api-route, read-only cache endpoint)

**Analog:** `app/api/trending/route.ts` (same as sentiment route).

**Apply to `app/api/hero/route.ts`:**
- Same shape as sentiment route above. Swap type to `HeroStory`, key to `CACHE_KEYS.hero` (10-min TTL).
- **Inline doc-comment requirement (D3, locked):** the route handler MUST contain an inline comment documenting that "top-3 on all 3 platforms" is a deliberate relaxation from the SCRUM-38 ticket's literal "#1 on all 3" wording. Future readers must not silently re-tighten.
- Cold-miss returns 503. Widget (`HeroStoryCard`) handles the 503 with client-side `deriveHeroStory()` fallback — never blank the card (per "Hero-card flicker policy" in CONTEXT).

---

### `vitest.config.ts` (config, net-new)

**Analog:** none in repo. Reference `tsconfig.json:20-22` for the `@/*` alias mapping.

**`tsconfig.json:20-22` (alias source of truth):**
```json
"paths": {
  "@/*": ["./*"]
}
```

**Apply to `vitest.config.ts`:**
- Per D6 (locked): `environment: "node"`, `@/*` alias to project root.
- Suggested skeleton:
```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```
- Per D6: test the pure-function core only — skip route handlers. Mocking guidance from CONTEXT: Redis/SWR can be mocked at the boundary; pure-function tests must not touch the network.

---

### Test files (`lib/topics.test.ts`, `lib/api/sentiment.test.ts`, `lib/api/trending.test.ts`, `lib/api/alerts.test.ts`, `lib/cache/timeseries.test.ts`)

**Analog:** none — first test files in the repo.

**Conventions (derived from D6 + CONTEXT decisions):**
- File location mirrors source: `lib/topics.test.ts` sits next to `lib/topics.ts`.
- Use Vitest's `describe` / `it` / `expect`.
- Import the system under test via `@/...` path alias (relies on `vitest.config.ts` alias).
- Boundary mocks only (Redis, network).

**Required coverage (per CONTEXT + Roadmap success criterion 7):**
- `lib/topics.test.ts` — alias matching, word-boundary behavior for "agents".
- `lib/api/sentiment.test.ts` — `preprocessText` (F2 contract: `@username`→`@user`, `http*`→`http`) AND aggregation (three percentages sum to 100).
- `lib/api/trending.test.ts` — velocity calc `(count_now − count_1h_ago) / 1h` AND hero promotion threshold (top-3-on-all-3).
- `lib/api/alerts.test.ts` — `detectSpike(velocity, baseline)` returns true when `velocity > 5 * baseline`.
- `lib/cache/timeseries.test.ts` — `zaddTimepoint` / `zrangeWindow` / `capToSlots` contracts with mocked redis client.

---

### `lib/api/trending.ts` (extended — refactor heuristic → velocity)

**Self-anchor (current heuristic to remove):** `lib/api/trending.ts:5-14, 56-109`

```typescript
// CURRENT (to be replaced)
const AI_TERMS = [
  "GPT-4", "GPT-5", "Claude", "Gemini", /* ... 50+ terms inline ... */
];

// CURRENT scorer (lines 77-109)
for (const term of AI_TERMS) {
  // count substring matches
  const velocity = mentionCount / timeSpanHours;
  const score = mentionCount * sources.length * Math.log2(velocity + 1);  // ← log2 heuristic
  // ...
}
results.sort((a, b) => b.score - a.score);
```

**Preserve from current file:**
- The `TextItem` extraction shape (`lib/api/trending.ts:16-54`) is fine — keep the `{text, source, timestamp}` extraction across YouTube/Reddit/X.
- `fetchAndCacheTrending(videos, posts, tweets)` signature (`lib/api/trending.ts:111-119`) — callers in the cron already use this. Keep the signature; refactor internals.
- Final `cacheSet(CACHE_KEYS.trending, topics)` write (line 117) — keep.

**Refactor target (per D2, D5, REQ-trending-velocity):**
1. Replace `AI_TERMS` import with `AI_TOPICS` from `@/lib/topics`.
2. Use the topic matching helper from `lib/topics.ts` (substring or `\b` regex per `wordBoundary` flag) instead of inline `text.toLowerCase().includes(termLower)`.
3. For each `(topic, platform)`, call `zaddTimepoint(key, now, count)` and `capToSlots(key, 96)` (per `lib/cache/timeseries.ts` contract).
4. Compute velocity via `zrangeWindow(key, now-3600s, now)` minus `zrangeWindow(key, now-7200s, now-3600s)` (D2 formula).
5. Sort by velocity, write to `CACHE_KEYS.trendingRanked` (10-min TTL, new key per CONTEXT) — preserve write to `CACHE_KEYS.trending` for backward-compat if the existing `/api/trending` reads the same key (it does — see `app/api/trending/route.ts:9`).
6. After ranking, for each topic call into `lib/api/alerts.ts` (`detectSpike` + `writeSpikeAlert`) — this is the "spike emit hook" per REQ-spike-alerts scope.

---

### `app/api/cron/refresh/route.ts` (extended — single-tier → 3-tier DAG)

**Self-anchor (current single-tier orchestration to refactor):** `app/api/cron/refresh/route.ts:13-90`

**Existing per-leg Sentry capture pattern** (lines 34-71) — preserve:
```typescript
if (ytResult.status === "fulfilled") {
  videos = ytResult.value;
  summary.youtube = "ok";
} else {
  console.error("[cron] YouTube fetch failed:", ytResult.reason);
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(ytResult.reason);
  }
}
```

**Existing GET (Bearer) + POST (QStash signature) split (lines 92-135)** — preserve unchanged. The DAG refactor is internal to `refreshAllFeeds()`.

**Refactor target (per D4, F3 — locked):**
1. Add at top of file: `export const maxDuration = 30;` (F3 — Vercel default 10s is too tight, DAG takes ~12s).
2. Split `refreshAllFeeds()` into 3 tiers, each wrapped in `Promise.allSettled`:
   - **Tier 1**: `[fetchYouTubeVideos, fetchRedditPosts, fetchTweets, fetchNews]` parallel — existing pattern (lines 22-28).
   - **Tier 2**: `fetchAndCacheTrending(videos, posts, tweets)` writes ZSETs — depends on Tier 1 fulfilled values.
   - **Tier 3**: `[heroPromoter(), writeSpikeAlertsFromTrending(), fetchAndCacheSentiment(items)]` parallel — depend on Tier 2.
3. Per-leg `Sentry.captureException` on failure — preserve existing pattern. Failure of any leg must NOT block siblings or downstream-tier siblings where they are independent.
4. Extend the `summary` object to include `hero`, `alerts`, `sentiment` keys.

---

### `lib/hooks/use-dashboard.ts` (extended — add 2 data legs)

**Self-anchor (current hook):** `lib/hooks/use-dashboard.ts:12-19`

```typescript
export function useDashboard() {
  const youtube = useApiData<Video[]>("/api/youtube");
  const reddit = useApiData<RedditPost[]>("/api/reddit");
  const twitter = useApiData<Tweet[]>("/api/x");
  const news = useApiData<NewsItem[]>("/api/news");
  const trending = useApiData<TrendingTopic[]>("/api/trending");
  return { youtube, reddit, twitter, news, trending };
}
```

**Apply (per REQ-dashboard-data-wiring):**
- Add two new lines following the exact same pattern:
```typescript
const sentiment = useApiData<Sentiment>("/api/sentiment");
const hero = useApiData<HeroStory>("/api/hero");
```
- Return them in the destructured object.
- Add the two new types to the type-imports list at top.
- **MUST reuse `useApiData`** — no direct `useSWR` per CLAUDE.md / CONTEXT. Override `refreshInterval` only if a widget genuinely needs a different cadence (sentiment 15-min cache → 60s SWR default is fine).

---

### `lib/types.ts` (extended — add Sentiment, SpikeAlert; extend HeroStory)

**Self-anchor (current types):** `lib/types.ts:44-56`

```typescript
export interface TrendingTopic {
  topic: string;
  mentionCount: number;
  velocity: number;
  sources: string[];
  score: number;
}

export interface HeroStory extends TrendingTopic {
  headline: string;
  thumbnailUrl: string | null;
  link: string | null;
}
```

**Apply (per REQ-sentiment-engine, REQ-spike-alerts, REQ-hero-auto-promotion):**
- Add:
```typescript
export interface Sentiment {
  positive: number;  // 0–100
  neutral: number;
  negative: number;
  sampleSize: number;
}

export interface SpikeAlert {
  topic: string;
  velocity: number;
  baseline: number;
  multiplier: number;
  detectedAt: string;  // ISO timestamp
}
```
- Optionally extend `HeroStory` with a `platforms: ("youtube" | "reddit" | "x")[]` discriminator if the API needs to mark cross-platform variants distinctly (CONTEXT line 146 leaves this as an option). Otherwise the existing `sources: string[]` is reused.

---

### `lib/constants.ts` (extended — add 4 cache keys)

**Self-anchor:** `lib/constants.ts:38-49`

```typescript
export const CACHE_KEYS = {
  youtube: "yt:latest",
  reddit: "reddit:hot",
  twitter: "x:feed",
  trending: "trending:topics",
  news: "news:feed",
} as const;

export const CACHE_MAX_AGE = {
  default: 15 * 60 * 1000, // 15 minutes
  twitter: 10 * 60 * 1000, // 10 minutes
} as const;
```

**Apply (per CONTEXT canonical refs, REQ-sentiment-engine, REQ-trending-velocity, REQ-hero-auto-promotion, REQ-spike-alerts):**
- Add to `CACHE_KEYS`:
  - `sentiment: "sentiment:latest"` (15-min TTL — use `CACHE_MAX_AGE.default`)
  - `trendingRanked: "trending:ranked"` (10-min TTL — add new entry to `CACHE_MAX_AGE` if needed, or reuse `twitter` value)
  - `hero: "hero:cross-platform"` (10-min TTL)
  - `spikes: "alerts:spikes"` (Redis list — no TTL, capped at 100 by LTRIM)
- Add a `tenMin` (or `hero`/`trendingRanked`) entry to `CACHE_MAX_AGE` if you want a named 10-min, or reuse `twitter`'s 10-min value. Planner picks.

---

### `components/widgets/SentimentWidget.tsx` (extended — placeholder → live data)

**Analog (sibling widget contract):** `components/widgets/NewsWidget.tsx`

**Props contract pattern** (`components/widgets/NewsWidget.tsx:54-64`):
```typescript
export function NewsWidget({
  items,
  stale,
  isLoading,
  error,
}: {
  items: NewsItem[] | null;
  stale: boolean;
  isLoading: boolean;
  error: Error | null;
}) {
```

**Loading / error / empty / data state ladder** (`NewsWidget.tsx:75-92`):
```typescript
{isLoading ? (
  <WidgetSkeleton lines={5} />
) : error ? (
  <p className="py-6 text-center text-[11px] text-muted">
    Failed to load — retrying...
  </p>
) : !items || items.length === 0 ? (
  <p className="py-6 text-center text-[11px] text-muted">
    No news available
  </p>
) : (
  <div>{/* render items */}</div>
)}
```

**WidgetCard usage** (`NewsWidget.tsx:67-74`):
```typescript
<WidgetCard
  icon="📰"
  iconBg="#0ea5e9"
  title="AI News"
  badge={count > 0 ? `${count} new` : undefined}
  stale={stale}
>
```

**Self-anchor (current placeholder to replace):** `components/widgets/SentimentWidget.tsx:3-37` — note hardcoded 58/26/16 sample data and `"Sample data"` badge — both must go.

**Apply (per REQ-sentiment-widget-polish):**
- New signature:
```typescript
export function SentimentWidget({
  data,
  stale,
  isLoading,
  error,
}: {
  data: Sentiment | null;
  stale: boolean;
  isLoading: boolean;
  error: Error | null;
}) { /* ... */ }
```
- Keep the visual treatment of the placeholder (3-segment bar + 3 legend rows) — the live data only changes the widths. Use `data.positive`, `data.neutral`, `data.negative` as the percentages.
- Verify the three percentages sum to 100 (acceptance criterion).
- Remove the `"Sample data"` badge. Replace with an optional sample-size badge (e.g., `n=${data.sampleSize}`) if useful.
- Theme tokens already in use are correct (`bg-green`, `bg-amber`, `bg-red`, `text-muted`, `font-space-mono`). Per CONTEXT line 114: match `--surface-2`, `--accent`, `--accent-secondary`. CLAUDE.md warning: `green`/`red`/`amber` override the full Tailwind scale — only DEFAULT/400/500 exist.
- The gate-2 HTML mockup under `arch/` is required *before* implementing per REQ-sentiment-widget-polish acceptance — note this is gate ordering, not a file the executor writes during this plan.

---

### `components/widgets/HeroStoryCard.tsx` (extended — add API-first fallback)

**Self-anchor:** `components/widgets/HeroStoryCard.tsx:56-159` — entire component is the anchor.

**Existing client-side derive (KEEP — used as fallback):** `HeroStoryCard.tsx:8-34`
```typescript
export function deriveHeroStory(
  topics: TrendingTopic[] | null,
  videos: Video[] | null,
  news: NewsItem[] | null,
): HeroStory | null { /* ... */ }
```

**Existing props** (`HeroStoryCard.tsx:56-68`):
```typescript
export function HeroStoryCard({
  topics, videos, news, isLoading, stale = false,
}: {
  topics: TrendingTopic[] | null;
  videos: Video[] | null;
  news: NewsItem[] | null;
  isLoading: boolean;
  stale?: boolean;
}) {
```

**Apply (per REQ-hero-auto-promotion + "Hero-card flicker policy" in CONTEXT):**
- Add a new optional prop `apiHero: HeroStory | null` (driven by `useDashboard().hero.data`).
- Render priority:
  1. If `apiHero` is present (truthy), render from `apiHero`.
  2. Else if `isLoading` (first paint), call `deriveHeroStory(...)` against currently available data and render that (NEVER blank — flicker policy).
  3. Else on 503 / null apiHero / fetch error, fall back to `deriveHeroStory(...)`.
- Existing return JSX (lines 97-158) is reused — derive a single `hero: HeroStory | null` variable at the top of the render and feed it through.
- Claude's Discretion: exact React state pattern for the fallback (CONTEXT line 113).

---

### `components/DashboardShell.tsx` (extended — pass new data)

**Self-anchor:** `components/DashboardShell.tsx:17, 49-69`

**Existing destructure** (line 17):
```typescript
const { youtube, reddit, twitter, news, trending } = useDashboard();
```

**Existing WidgetErrorBoundary wrap + prop pass-through pattern** (lines 48-69):
```typescript
<WidgetErrorBoundary fallbackTitle="Story unavailable">
  <HeroStoryCard
    topics={trending.data}
    videos={youtube.data}
    news={news.data}
    isLoading={trending.isLoading}
    stale={trending.stale || youtube.stale || news.stale}
  />
</WidgetErrorBoundary>

<WidgetErrorBoundary fallbackTitle="Sentiment unavailable">
  <SentimentWidget />   {/* ← no props currently */}
</WidgetErrorBoundary>
```

**Apply (per REQ-dashboard-data-wiring + REQ-sentiment-widget-polish):**
- Destructure: `const { youtube, reddit, twitter, news, trending, sentiment, hero } = useDashboard();`
- Update `<HeroStoryCard ... />`: add `apiHero={hero.data}` (or whichever prop name the widget exposes); preserve all existing fallback props for the client-derive path.
- Update `<SentimentWidget ... />`: pass the four standard props:
```typescript
<SentimentWidget
  data={sentiment.data}
  stale={sentiment.stale}
  isLoading={sentiment.isLoading}
  error={sentiment.error}
/>
```
- The existing `WidgetErrorBoundary` wraps stay unchanged.

---

### `.env.example` (extended — add env vars)

**Self-anchor:** full current file (`.env.example:1-14`)

```
YOUTUBE_API_KEY=
APIFY_API_TOKEN=
X_BEARER_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_TRACES_SAMPLE_RATE=1
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=1
```

**Apply (per F1, REQ-env-contract):**
- Add:
  - `TOGETHER_API_KEY=`
  - `SENTIMENT_DAILY_CHAR_BUDGET=200000`
- **MUST NOT add** `HUGGINGFACE_API_TOKEN` (F1 explicitly forbids).
- Acceptance check (CONTEXT line 188): `grep -r HUGGINGFACE .env.example CLAUDE.md` must be empty after changes.

---

### `CLAUDE.md` (extended — Commands + Environment Variables sections)

**Self-anchor — Commands section** (`CLAUDE.md` ~lines 9-13):
```
- `npm run dev` — start dev server (localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint with Prettier compatibility
- No test framework configured yet
```

**Self-anchor — Environment Variables section** (`CLAUDE.md` near bottom):
```
See `.env.example` for all variables. Required: `YOUTUBE_API_KEY`, ..., `CRON_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`. Optional: ...
```

**Apply (per D6, F1, REQ-env-contract, REQ-vitest-bootstrap):**
- Commands section: replace "No test framework configured yet" with `- \`npm test\` — run Vitest unit tests` (plus optionally `test:watch` / `test:coverage`).
- Environment Variables section:
  - Add `TOGETHER_API_KEY` and `SENTIMENT_DAILY_CHAR_BUDGET` to Required (or Optional with default note for the budget).
  - Ensure `HUGGINGFACE_API_TOKEN` is NOT mentioned anywhere.

---

### `package.json` (extended — Vitest deps + scripts)

**Self-anchor:** `package.json:5-10` (scripts) and `package.json:23-34` (devDependencies)

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
}
```

**Apply (per D6, REQ-vitest-bootstrap):**
- Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`.
- Add devDependencies: `vitest`, `@vitest/coverage-v8`, `tsx`.
- Acceptance (Roadmap success criterion 7): `npm test` exits 0 with all five required test files present.

---

## Shared Patterns

### Lazy Redis client
**Source:** `lib/cache/redis.ts:5-13`
**Apply to:** `lib/cache/timeseries.ts`, `lib/api/alerts.ts`, and anywhere else needing raw Redis access.
```typescript
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}
```
**Rule:** NEVER `new Redis()` at module scope — Upstash validates env vars at construction time and breaks `next build`. Always call `getRedis()` inside the function that uses it.

### Cache read/write (TTL'd JSON)
**Source:** `lib/cache/helpers.ts:6-39`
**Apply to:** `app/api/sentiment/route.ts`, `app/api/hero/route.ts` (read via `cacheGet`); `lib/api/sentiment.ts` (write via `cacheSet`); writers in trending and hero promoter.
**Rule:** Use everywhere EXCEPT the alerts list (`alerts:spikes`) — that uses raw `LPUSH`/`LTRIM` per CON-alerts-spikes-cap.

### Read-only cache route shape
**Source:** `app/api/trending/route.ts:1-23`
**Apply to:** `app/api/sentiment/route.ts`, `app/api/hero/route.ts`
```typescript
import { NextResponse } from "next/server";
import { cacheGet } from "@/lib/cache/helpers";
import { CACHE_KEYS, CACHE_MAX_AGE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const cached = await cacheGet<T>(CACHE_KEYS.X, CACHE_MAX_AGE.default);
  if (!cached) {
    return NextResponse.json(
      { data: ..., cachedAt: null, stale: false, error: "No data available" },
      { status: 503 },
    );
  }
  return NextResponse.json({
    data: cached.data,
    cachedAt: cached.fetchedAt,
    stale: cached.stale,
  });
}
```

### SWR data fetching
**Source:** `lib/hooks/use-api-data.ts:6-39`
**Apply to:** `lib/hooks/use-dashboard.ts` extension (new `sentiment` and `hero` legs).
**Rule (CLAUDE.md):** NEVER call `useSWR` directly — always go through `useApiData`. Override `refreshInterval` arg only when a widget genuinely needs a different cadence.

### Widget contract `{data | items, stale, isLoading, error}`
**Source:** `components/widgets/NewsWidget.tsx:54-64` (canonical example with state ladder lines 75-92)
**Apply to:** `components/widgets/SentimentWidget.tsx` (must conform — currently doesn't).
**Rule:** Every data widget accepts the four props, renders via `WidgetCard`, and handles loading / error / empty / data states internally. `DashboardShell` wraps the widget in `WidgetErrorBoundary`.

### Sentry error capture (server side)
**Source:** `app/api/cron/refresh/route.ts:38-41`
**Apply to:** `lib/api/sentiment.ts` (especially 401 from vendor — per CON-key-rotation-observability — DO NOT swallow).
```typescript
console.error("[cron] X fetch failed:", result.reason);
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.captureException(result.reason);
}
```
**Rule (CLAUDE.md):** always guard `Sentry.captureException` with the `NEXT_PUBLIC_SENTRY_DSN` env check to keep local dev quiet.

### `Promise.allSettled` orchestration
**Source:** `app/api/cron/refresh/route.ts:22-28` (Tier-1 style) and `lib/api/twitter.ts:35-92` (per-user fan-out)
**Apply to:** all three tiers of the new cron DAG (per D4 — each tier wrapped in `Promise.allSettled`).
**Rule:** failure of any leg must NOT block siblings or downstream-tier siblings where they are independent.

### Path alias `@/*`
**Source:** `tsconfig.json:20-22`
**Apply to:** `vitest.config.ts` (must replicate this alias so test imports `@/lib/...` resolve correctly).

---

## No Analog Found

Files with no close match in the codebase — planner should use this file's "Apply to" guidance plus RESEARCH.md / external docs:

| File | Role | Data Flow | Reason | Reference docs |
|------|------|-----------|--------|----------------|
| `lib/cache/timeseries.ts` | cache (ZSET wrapper) | CRUD (ZADD/ZRANGEBYSCORE/ZREMRANGEBYRANK) | No existing ZSET usage anywhere in the codebase (verified via grep). | Upstash Redis docs — ZSET semantics |
| `lib/api/alerts.ts` | api-client (list writer) | CRUD (LPUSH/LTRIM) | No existing list-push usage in the codebase. | Upstash Redis docs — list commands |
| `vitest.config.ts` | config | static | First test framework in repo. | Vitest docs — config format, `environment: "node"`, alias resolution |
| All 5 `*.test.ts` files | test (pure function) | static | First test files in repo. | Vitest docs — `describe` / `it` / `expect`, mocking at boundary |

For the two raw-redis modules, the lazy `getRedis()` import pattern from `lib/cache/helpers.ts:1` is reusable — only the redis method calls (zadd / lpush etc.) are net-new.

## Metadata

**Analog search scope:** `/app`, `/components`, `/lib` (full TypeScript tree, excluding `/node_modules`, `/.next`, `/.claude`, `/.planning`, `/arch`, gstack tooling).
**Files scanned:** 41 (.ts/.tsx in source dirs).
**Files read in full for pattern extraction:** 18 (the canonical analogs + every extended file's current shape).
**Verified gaps:** `grep -rn "getRedis\|zadd\|zrange\|LPUSH\|LTRIM"` shows ZSET and list-push patterns are net-new (only `cacheGet`/`cacheSet`/`ping` use `getRedis()` today).
**Pattern extraction date:** 2026-05-11
