# SCRUM-42: Sentiment Analysis Backend & SentimentBar Widget

**Jira**: [SCRUM-42](https://prabhneet.atlassian.net/browse/SCRUM-42)
**Epic**: SCRUM-27 (AIP-Dash)
**Blocks**: SCRUM-37 (SentimentBar component in the frontend dashboard)
**Sprint**: SCRUM Sprint 1

---

## Context

SCRUM-37 specifies a SentimentBar widget (positive/neutral/negative segmented bar), but the codebase has zero sentiment infrastructure — no analysis engine, no types, no cache key, no API route. This ticket implements the full vertical slice.

---

## Architecture Overview

```
Cron Refresh (existing)
  |
  +-- fetchYouTubeVideos()  --> Video[]
  +-- fetchRedditPosts()    --> RedditPost[]
  +-- fetchTweets()         --> Tweet[]
  +-- fetchNews()           --> (not text-heavy, skip for sentiment)
  +-- fetchAndCacheTrending(videos, posts, tweets)  [existing]
  +-- analyzeSentimentAndCache(videos, posts, tweets)  [NEW]
       |
       +-- reads text from all 3 platforms
       +-- classifies each item: positive / neutral / negative
       +-- aggregates into SentimentBreakdown
       +-- cacheSet("sentiment:breakdown", result)

API Route
  GET /api/sentiment --> reads from cache --> ApiResponse<SentimentBreakdown>

Widget
  SentimentBar.tsx --> useSWR("/api/sentiment") --> renders segmented bar
```

---

## Implementation Plan

### Phase 1: Types & Constants

**File: `lib/types.ts`** — Add after `TrendingTopic` (line 50):

```typescript
export interface SentimentBreakdown {
  positive: number;    // percentage 0-100
  neutral: number;     // percentage 0-100
  negative: number;    // percentage 0-100
  totalAnalyzed: number;
  byPlatform: {
    youtube: { positive: number; neutral: number; negative: number };
    reddit: { positive: number; neutral: number; negative: number };
    twitter: { positive: number; neutral: number; negative: number };
  };
}
```

**File: `lib/constants.ts`** — Add to `CACHE_KEYS` (line 38) and `CACHE_MAX_AGE` (line 46):

```typescript
// In CACHE_KEYS:
sentiment: "sentiment:breakdown",

// In CACHE_MAX_AGE:
sentiment: 15 * 60 * 1000, // 15 minutes (same as default)
```

### Phase 2: Sentiment Analysis Engine

**New file: `lib/api/sentiment.ts`**

Use keyword-based classification (Option A from ticket — zero external dependencies).

#### Design

The engine reuses the same `extractTextItems()` pattern from `lib/api/trending.ts` (lines 22-54) to normalize content from all 3 platforms into text items.

#### Keyword Dictionaries

Two dictionaries tuned for AI industry sentiment:

**Positive signals** (content expressing progress, excitement, capability):
- breakthrough, impressive, state-of-the-art, outperforms, exciting, revolutionary
- open source, release, launch, available, free, democratize
- faster, better, efficient, improvement, upgrade, milestone
- amazing, incredible, game-changer, powerful

**Negative signals** (content expressing concern, failure, risk):
- concern, dangerous, risk, threat, unsafe, harmful, misuse
- hallucination, bias, inaccurate, unreliable, fails, broken
- layoffs, replace, job loss, unemployment, extinction
- lawsuit, copyright, stolen, scraped, violation
- ban, regulate, restrict, shutdown, censorship
- disappointing, overhyped, underwhelming, worse

#### Scoring Algorithm

```
For each text item:
  1. Lowercase the text
  2. Count positive keyword matches -> posHits
  3. Count negative keyword matches -> negHits
  4. If posHits > negHits -> classify as "positive"
  5. If negHits > posHits -> classify as "negative"
  6. Otherwise -> classify as "neutral"
```

This is intentionally simple. Accuracy can be improved later with an NLP API (Option B) without changing the type contract or API surface.

#### Function Signatures

```typescript
// Internal types
type SentimentLabel = "positive" | "neutral" | "negative";

interface ClassifiedItem {
  text: string;
  source: "youtube" | "reddit" | "twitter";
  sentiment: SentimentLabel;
}

// Public API
export function analyzeSentiment(
  videos: Video[],
  posts: RedditPost[],
  tweets: Tweet[],
): SentimentBreakdown;

export async function analyzeSentimentAndCache(
  videos: Video[],
  posts: RedditPost[],
  tweets: Tweet[],
): Promise<SentimentBreakdown>;
```

#### Key implementation notes

- Reuse the `TextItem` extraction pattern from `trending.ts` (videos -> title, posts -> title, tweets -> text)
- For Reddit posts: use `title` only (body text is not available in `RedditPost` type)
- For YouTube: use `title` only (descriptions not in `Video` type)
- For tweets: use `text` field (full tweet content)
- Percentages must sum to 100 (use Math.round with adjustment on the largest segment)
- `totalAnalyzed` = total number of text items processed
- `byPlatform` breaks down the same percentages per source
- `cacheSet` uses `{ allowEmpty: false }` default — but since SentimentBreakdown is an object (not array), it will always be cached. Consider adding a guard: skip cache if `totalAnalyzed === 0`.

### Phase 3: Cron Integration

**File: `app/api/cron/refresh/route.ts`**

Modify `refreshAllFeeds()` to add sentiment analysis after the trending step.

#### Changes

1. Add import at top (after line 10):
```typescript
import { analyzeSentimentAndCache } from "@/lib/api/sentiment";
```

2. Add `sentiment: "failed"` to the summary object (line 14).

3. After the trending block (after line 83), add:

```typescript
if (videos.length > 0 || posts.length > 0 || tweets.length > 0) {
  try {
    await analyzeSentimentAndCache(videos, posts, tweets);
    summary.sentiment = "ok";
  } catch (err) {
    console.error("[cron] Sentiment analysis failed:", err);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(err);
    }
  }
}
```

This follows the exact same error handling pattern as the trending block (lines 73-83).

#### Why after trending (not parallel)

- Sentiment is CPU-bound keyword matching, not I/O. It runs in <10ms for typical payloads.
- Running it sequentially after trending avoids complexity and keeps the cron flow linear and debuggable.
- If it fails, it does not affect any other feed.

### Phase 4: API Route

**New file: `app/api/sentiment/route.ts`**

Clone the exact pattern from `app/api/trending/route.ts` (24 lines):

```typescript
import { NextResponse } from "next/server";
import { cacheGet } from "@/lib/cache/helpers";
import { CACHE_KEYS, CACHE_MAX_AGE } from "@/lib/constants";
import type { SentimentBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const cached = await cacheGet<SentimentBreakdown>(
    CACHE_KEYS.sentiment,
    CACHE_MAX_AGE.sentiment,
  );

  if (!cached) {
    return NextResponse.json(
      { data: null, cachedAt: null, stale: false, error: "No data available" },
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

Note: returns `data: null` (not `data: []`) on 503, since `SentimentBreakdown` is an object, not an array.

### Phase 5: SentimentBar Widget

**New file: `components/widgets/SentimentBar.tsx`**

This phase is part of SCRUM-37's frontend work but is documented here for completeness.

#### Component structure

```
SentimentBar (WidgetCard wrapper)
  +-- Segmented horizontal bar (3 flex segments)
  |     +-- Positive (green-500 #22c55e)
  |     +-- Neutral (gray-500 #6b7280)
  |     +-- Negative (red-500 #ef4444)
  +-- Percentage labels inside or below segments
  +-- Legend row (colored dots + labels)
```

#### Data hook

```typescript
// hooks/useSentiment.ts (or inline in useDashboard)
import useSWR from "swr";
import type { ApiResponse, SentimentBreakdown } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
});

export function useSentiment() {
  return useSWR<ApiResponse<SentimentBreakdown>>(
    "/api/sentiment",
    fetcher,
    { refreshInterval: 60_000 },
  );
}
```

#### States

| State | UI |
|-------|-----|
| Loading (`!data && !error`) | Skeleton bar (pulsing gray bar) |
| Error (`error`) | "Sentiment data unavailable" in WidgetCard |
| Stale (`data.stale`) | Normal render + subtle "outdated" indicator |
| Empty (`data.data.totalAnalyzed === 0`) | "Not enough data for sentiment analysis" |
| Normal | Segmented bar with percentages |

#### Tailwind implementation hint

```html
<!-- Bar segments use inline width percentages -->
<div class="flex h-6 w-full overflow-hidden rounded-full">
  <div class="bg-green-500 transition-all duration-500" style={{ width: `${positive}%` }} />
  <div class="bg-gray-500 transition-all duration-500" style={{ width: `${neutral}%` }} />
  <div class="bg-red-500 transition-all duration-500" style={{ width: `${negative}%` }} />
</div>
```

---

## Files Changed (Summary)

| File | Action | Phase |
|------|--------|-------|
| `lib/types.ts` | Edit — add `SentimentBreakdown` interface | 1 |
| `lib/constants.ts` | Edit — add cache key + TTL | 1 |
| `lib/api/sentiment.ts` | **Create** — keyword engine + cache wrapper | 2 |
| `app/api/cron/refresh/route.ts` | Edit — add sentiment step to refresh pipeline | 3 |
| `app/api/sentiment/route.ts` | **Create** — GET endpoint | 4 |
| `components/widgets/SentimentBar.tsx` | **Create** — widget component (SCRUM-37 scope) | 5 |

---

## Testing Strategy

### Unit tests for `lib/api/sentiment.ts`

| Test case | Input | Expected |
|-----------|-------|----------|
| All positive content | 3 items with "breakthrough", "amazing", "impressive" | positive >= 90%, negative ~0% |
| All negative content | 3 items with "dangerous", "hallucination", "lawsuit" | negative >= 90%, positive ~0% |
| Mixed content | 1 positive, 1 negative, 1 neutral | ~33% each |
| Empty input | no videos, posts, or tweets | totalAnalyzed: 0, all percentages: 0 |
| Single platform | only tweets provided | byPlatform.youtube all 0, twitter has values |
| Percentages sum to 100 | any input | positive + neutral + negative === 100 |

### Integration tests for `/api/sentiment`

| Test case | Expected |
|-----------|----------|
| No cached data | 503 with `{ data: null }` |
| Valid cached data | 200 with `ApiResponse<SentimentBreakdown>` |
| Stale cached data | 200 with `stale: true` |

### Cron integration

| Test case | Expected |
|-----------|----------|
| All feeds succeed | `summary.sentiment === "ok"` |
| Sentiment throws | `summary.sentiment === "failed"`, other feeds unaffected |
| No content fetched | Sentiment step skipped (guard: `videos.length > 0 || ...`) |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Keyword-based accuracy is low | Medium | Low (MVP) | Ship as-is; upgrade to NLP API in a follow-up ticket without changing types/API |
| AI industry keywords evolve | Medium | Low | Keywords are in a single array — easy to update |
| `cacheSet` silently skips empty arrays but SentimentBreakdown is an object | Low | Medium | Add explicit `totalAnalyzed > 0` guard before caching |
| Rounding errors (percentages don't sum to 100) | High | Low | Use Math.round + adjust largest segment to force sum to 100 |

---

## Future Enhancements (Out of Scope)

- **Option B upgrade**: Replace keyword engine with Hugging Face Inference API for higher accuracy
- **Sentiment trends**: Store historical snapshots to show sentiment change over time
- **Per-content labels**: Tag individual tweets/posts with sentiment for filtering
- **Weighted scoring**: Weight by engagement (high-upvote negative post > low-upvote negative post)
