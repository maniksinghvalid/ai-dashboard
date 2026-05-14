---
phase: 03-caching-refresh-hardening
plan: 05
status: complete
date: 2026-05-14
---

# 03-05 Summary — 4h TTL + Reddit/.rss + X token sync

## What shipped

| Task | Result |
|------|--------|
| 1 — Lower hard-TTL to 4h | `SAFETY_TTL_SECONDS` 86400 → 14400 in `lib/cache/helpers.ts`; `helpers.test.ts` asserts `ex: 14400`. |
| 2 — Trim `RedditPost` | Removed `score`/`numComments`/`flair` from `lib/types.ts`; removed `REDDIT_FLAIR_ALLOWLIST` from `lib/constants.ts`. Only consumers were `RedditWidget` (Task 4). |
| 3 — Reddit → `.rss` Atom | `lib/api/reddit.ts` rewritten: fetches `*/hot.rss`, parses with `rss-parser`, new `normalizeRedditAtomEntry` (strips `t3_` / `/u/`). Kept per-sub `allSettled`, UA, 429/503 retry. Dropped JSON normalizer + `isPostKeepable` + `isFlairAllowed`. `reddit.test.ts` rewritten — 10 tests against Atom fixtures. |
| 4 — RedditWidget redesign | `PostRow` rebuilt around subreddit/title/author/time (no score column, no comment count, `formatScore` removed). Error copy in `RedditWidget` + `XFeedWidget`: "Failed to load — retrying..." → "Feed temporarily unavailable". |
| 5 — CLAUDE.md | `lib/api/` line, `helpers.ts` line, `lib/types.ts` line updated to reflect the 4h TTL and the Reddit `.rss` source. |
| 6 — Sync X token (manual) | **NOT done — user action.** Set `X_BEARER_TOKEN` in Vercel to the read-capable token + redeploy. |

## Verification

- `npm test` — 70 passed (10 in the rewritten `reddit.test.ts`)
- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `npm run build` — succeeds; `/` prerenders static (full widget tree compiles + renders)

## Open / accepted risk

- **D7 (accepted):** the `.rss`-bypasses-the-Vercel-403 assumption is unverified — verify on deploy. Watch one cron cycle: `reddit:hot` `fetchedAt` must advance, no `[reddit] Non-200` in logs. If `.rss` is also 403'd, fall back to Reddit OAuth (see `TODOS.md`).
- **Task 6** is a prerequisite for X to recover — code is untouched and proven working; only the Vercel env token needs syncing.
- `hero:cross-platform` recovers on its own once Reddit + X feed trending again — no hero code change.

## Tooling kept

`scripts/diag-fetchers.ts`, `diag-redis-ttl.ts`, `diag-reddit-alts.ts` — repeatable diagnostics for the verify-on-deploy step (made module-scoped with `export {}` to satisfy `tsc`).
