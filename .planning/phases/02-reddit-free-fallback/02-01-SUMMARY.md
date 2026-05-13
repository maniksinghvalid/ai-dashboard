---
phase: 02-reddit-free-fallback
plan: 01
subsystem: api
tags: [reddit, fetch, apify-removal, vitest, tdd]

requires:
  - phase: 01-foundation
    provides: cacheSet helper, SUBREDDITS constant, REDDIT_FLAIR_ALLOWLIST, RedditPost type
provides:
  - Apify-free Reddit fetch via the anonymous JSON endpoint
  - Stickied + NSFW filter at the source
  - Per-subreddit error isolation via Promise.allSettled with single 429/503 retry + 2–5s jitter
  - Optional REDDIT_USER_AGENT env override (no PII in source default)
affects: [cron-refresh, hero-promotion, trending-aggregator]

tech-stack:
  added: []
  patterns:
    - "Per-source allSettled + per-call single-retry-with-jitter (mirrors YouTube path)"

key-files:
  created:
    - lib/api/reddit.test.ts
    - .planning/phases/02-reddit-free-fallback/02-01-SUMMARY.md
  modified:
    - lib/api/reddit.ts
    - .env.example
    - CLAUDE.md

key-decisions:
  - "Clean replacement, not a chained fallback — Apify is failing today, YAGNI for a chain"
  - "Tighten isPostKeepable to reject both stickied AND over_18 from the first commit, keeping Task 1 + Task 2 + Task 4 consistent"
  - "Pin the retry-fails test to a specific subreddit (MachineLearning) instead of the plan's global counter — fixes a mock-logic bug that double-counted parallel allSettled calls"

patterns-established:
  - "RedditJsonChild internal contract: subset of the Reddit `t3.data` shape we actually consume"
  - "Default User-Agent string baked in source, overridable via env — no PII committed"

requirements-completed: []

duration: ~12min
completed: 2026-05-13
---

# Phase 02-01: Reddit Free Fallback Summary

**Replaced the failing Apify Reddit scraper with Reddit's free public JSON endpoint while preserving the caller contract, cache envelope, and downstream consumer behavior.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-13T02:48Z
- **Completed:** 2026-05-13T02:52Z
- **Tasks:** 4 automated + 1 manual handoff
- **Files modified:** 4 (2 source, 2 docs)

## Accomplishments
- Eliminated the `Maximum cost per run is lower then actor start cost` failure mode by dropping the `ApifyClient` codepath entirely.
- New `fetchRedditPosts` exercises `fetch('https://www.reddit.com/r/<sub>/hot.json?limit=25')` with a documented UA, single-retry on 429/503, and `Promise.allSettled` so one bad subreddit cannot drop the rest.
- 14 colocated Vitest tests cover the normalizer, the keepability filter (stickied + NSFW), the happy path, retry-succeeds, retry-fails, malformed body, non-`t3` filter, and `res.json()` throwing.
- `REDDIT_USER_AGENT` documented as optional in `.env.example` + `CLAUDE.md`; default UA points at the repo (no PII committed).

## Task Commits

1. **Task 1: Failing tests for normalizer + isPostKeepable** — RED state confirmed (not committed; folded into Task 2).
2. **Task 2: Implement normalizer + isPostKeepable** — `66b04aa` (feat)
3. **Task 3: Failing fetchRedditPosts integration tests** — RED state confirmed (not committed; folded into Task 4).
4. **Task 4: Replace fetchRedditPosts body + env docs** — `b404c97` (feat)

_Test additions ride with the feat commit they unblock — consistent with the project's existing TDD-by-commit-pair pattern (see `lib/api/sentiment.test.ts` history)._

## Files Created/Modified
- `lib/api/reddit.test.ts` — 14 tests across `normalizeRedditJsonPost`, `isPostKeepable`, and `fetchRedditPosts` describe blocks.
- `lib/api/reddit.ts` — full rewrite. Drops `ApifyClient` + `normalizeApifyPost`. Adds `RedditJsonChild`/`RedditJsonResponse` interfaces, `normalizeRedditJsonPost`, `isPostKeepable`, `RETRY_STATUS`, `jitterMs`, `fetchOnce`, `fetchSubreddit`. Same exported signature for `fetchRedditPosts`.
- `.env.example` — adds `REDDIT_USER_AGENT=` with a Reddit-policy comment.
- `CLAUDE.md` — appends `REDDIT_USER_AGENT` to the Optional env list with the default UA string.

## Decisions Made
- **isPostKeepable tightened in Task 2 (not Task 4).** The plan flags this as expected: keeps Task 1 tests + Task 2 implementation aligned without a no-op step.
- **No `apify-client` removal from `package.json`.** Deferred per plan + TODOS.md — separate cleanup commit once the JSON path bakes in.

## Deviations from Plan

### Auto-fixed Issues

**1. Mock-logic bug in retry-fails test (Task 4 verification)**
- **Found during:** Task 4 (`npm test -- lib/api/reddit.test.ts` after rewriting `fetchRedditPosts`).
- **Issue:** The verbatim mock from the arch plan used a global counter `failureSubCalls < 2` to fail "the first subreddit twice." Because `Promise.allSettled` fires all 5 subreddit fetches in parallel, the first 2 invocations across any 2 subreddits hit the failing branch — both retry and succeed — yielding 5 posts instead of the asserted 4.
- **Fix:** Pinned the failure to a specific subreddit (`MachineLearning`). Both the initial fetch and the retry for that sub now 429; the other 4 succeed on first try. Matches the test's documented intent.
- **Files modified:** `lib/api/reddit.test.ts`
- **Verification:** 14/14 tests green.
- **Committed in:** `b404c97`

**2. TypeScript widening on `json: () => Promise<never>`**
- **Found during:** Task 4 verification (`npx tsc --noEmit`).
- **Issue:** TS2352 — `{ json: async () => { throw } }` doesn't widen to `Response` because the throwing arrow returns `Promise<never>`.
- **Fix:** Added the explicit `as unknown as Response` cast on the json-throws mock only. Other mocks still use plain `as Response`.
- **Files modified:** `lib/api/reddit.test.ts`
- **Verification:** `npx tsc --noEmit` clean.
- **Committed in:** `b404c97`

## Verification

- `npm test` — 58/58 passing across 7 files (14 in `lib/api/reddit.test.ts`).
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `grep -c ApifyClient lib/api/reddit.ts` — 0.
- `grep REDDIT_USER_AGENT .env.example CLAUDE.md` — both present.

## Pending Manual Steps (Task 5)

Cannot run from here — requires the user's dev server, network access, and a production deploy + QStash window.

1. **Local cron smoke (Sub-step A):**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health   # expect 200
   set -a && source .env.local && set +a && \
     curl -s -o /tmp/cron.json -w "HTTP %{http_code}  %{time_total}s\n" \
       -H "Authorization: Bearer ${CRON_SECRET}" \
       http://localhost:3000/api/cron/refresh && jq '.summary' /tmp/cron.json
   curl -s http://localhost:3000/api/reddit | jq '{count: (.data | length), cachedAt, stale}'
   ```
   Expect: `summary.reddit: "ok"`, 30–80 keepable posts, no `[cache] skipping empty write to "reddit:hot"` warn.

2. **Production verify (Sub-step B):**
   - Open a PR `feature/reddit-free-fallback → develop` and merge (or push the branch and let the develop alias rebuild after the PR lands).
   - Within 15 min of the next QStash tick:
     ```bash
     vercel logs --scope maniks-projects-b7b7b384 --no-follow --since 30m \
       ai-dashboard-git-develop-maniks-projects-b7b7b384.vercel.app \
       | grep -E '\[reddit\]|\[cache\] skipping empty write to "reddit:hot"'
     ```
   - Expect: zero `[cache] skipping empty write to "reddit:hot"` lines.

3. **Vercel env var (optional):** Add `REDDIT_USER_AGENT` (blank value is fine) to Preview + Production scopes if the user wants to track Reddit traffic attribution via the UA. The in-code default already includes a contact URL, so this is purely operational.

4. **7-day OAuth tripwire:** Calendar reminder for 2026-05-20. If `[reddit] Non-200 response` log lines exceed ~20% of subreddit fetches across the week, escalate to authenticated Reddit OAuth per the source plan's "Notes & gotchas."

## Self-Check: PASSED
- All four automated tasks complete on `feature/reddit-free-fallback`.
- 14 Reddit tests green; full suite (58/58) green.
- `npx tsc --noEmit && npm run lint` clean.
- No `ApifyClient` reference in `lib/api/reddit.ts`.
- Manual Task 5 documented above with verbatim commands.
