# TODOS

Deferred work captured during planning and review. Each item carries enough context that a future engineer (or future you) can pick it up cold.

---

## Remove `apify-client` from `package.json`

**Source:** `/plan-eng-review` of `arch/reddit-free-fallback-plan.md` (2026-05-13)

**What:** Drop the `apify-client` npm dependency once the new Reddit JSON path is verified stable in production for ~1 week.

**Why:** The Reddit-free-fallback plan removes the only consumer of `apify-client` from `lib/api/reddit.ts`. Leaving it in `package.json` adds a transitive dep tree (~12 packages, ~3MB node_modules bloat) for no functional use.

**Pros:** Smaller install, cleaner deps, reduced supply-chain surface.
**Cons:** If we ever want Apify as a future Reddit fallback (e.g., scraping NSFW-filtered alternatives), we'd reinstall.

**Verification:** After Reddit JSON path ships and runs cleanly for ~7 days, confirm zero callers:
```sh
grep -r 'apify-client' --include='*.ts' --include='*.tsx' lib/ app/ components/ | wc -l
# Expected: 0
```
Then `npm uninstall apify-client && npm run build && npm test` and commit.

**Depends on:** Reddit JSON fallback merged and stable for 7 days (i.e., no rollback by ~2026-05-20).

---

## Frontend audit: `RedditPost.url` consumers

**Source:** `/plan-eng-review` of `arch/reddit-free-fallback-plan.md` (2026-05-13), D4 resolution

**What:** Verify no component in `components/` treats `RedditPost.url` as a Reddit-only URL.

**Why:** The Reddit-free-fallback plan preserves the Apify semantic for `RedditPost.url` (external link for link-posts, Reddit URL for self-posts). This was chosen to *avoid* a regression but the assumption wasn't verified against the frontend. A 15-min audit closes the loop.

**How to do it:**
1. `grep -rn 'post\.url\|p\.url\|\.url ' components/` — find all `url` accesses on Reddit-shaped data.
2. For each call site, check the surrounding UI: label text ("Open on Reddit" vs "Open link"), hover state, favicon/domain rendering, click handler.
3. If anything assumes `reddit.com` in the URL (e.g., regex matching, domain extraction for icons), file as a follow-up bug or harden the assumption.
4. Likely starting points: `components/RedditWidget.tsx`, `components/HeroStoryCard.tsx` (if it surfaces Reddit posts).

**Depends on:** Nothing (can be done any time, even before Reddit fallback ships).

**Pros:** Closes the D4 trust gap. Catches UX regression before a user does.
**Cons:** 15 min of grep work that may find nothing — but that's the point.

---

## Reddit OAuth tripwire — re-check on 2026-05-20

**Source:** `arch/reddit-free-fallback-plan.md` Notes & gotchas (2026-05-13); also `.planning/phases/02-reddit-free-fallback/02-01-PLAN.md` Task 5 sub-step C

**What:** 7-day post-ship monitor on the Reddit anonymous JSON path. Re-check on or before **2026-05-20**.

**Why:** Reddit has been actively flagging cloud-provider egress IPs since 2023 — Vercel function IPs occasionally get 403'd regardless of volume. The shipped path (commits `66b04aa` + `b404c97`) uses anonymous fetch with a single retry on 429/503; if Reddit blanket-blocks the Vercel IP range, the per-subreddit `Promise.allSettled` keeps the cron running but the cache empties out silently.

**How to check:**
1. `vercel logs --scope <scope> --since 7d ai-dashboard-git-develop-<...>.vercel.app | grep '\[reddit\]'`
2. Count `[reddit] Non-200 response` lines and divide by total subreddit fetches in the window (5 subs × ~96 ticks/day × 7 days ≈ 3360).
3. **If failure rate > 20%** (i.e. >672 hits in the 7-day window), escalate to authenticated Reddit OAuth: register an app at https://reddit.com/prefs/apps, add `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_USERNAME` / `REDDIT_PASSWORD` env vars, exchange for a bearer token before fetch. OAuth bumps the rate limit to 100/min and is still free.

**Depends on:** `b404c97` (Reddit JSON path) deployed and running for ~7 days without rollback.

**Pros:** Catches IP-blocklist regressions before they cascade into a stale Reddit widget. **Cons:** 5-min manual check.

---

*This file is the canonical home for deferred work. When picking up an item: link the PR back to the section so context isn't lost.*
