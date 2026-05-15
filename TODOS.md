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

**Status (2026-05-14):** 03-05 **changed** the `RedditPost.url` semantic — the `.rss` Atom feed only exposes the Reddit comments permalink, so `url` is now *always* the permalink (no external link-post URL). `lib/api/hero.ts:74` (`link: matchingNews?.link ?? matchingPost?.url ?? ...`) was reviewed during the 03-05 code review: a Reddit-backed hero CTA now points at the Reddit thread instead of the source article — **accepted**, since `matchingNews?.link` is tried first and a permalink is a reasonable destination. The remaining `components/` audit below is still worth doing for label/icon assumptions.

**What:** Verify no component in `components/` treats `RedditPost.url` as a Reddit-only URL.

**Why:** The Reddit-free-fallback plan preserved the Apify semantic for `RedditPost.url` (external link for link-posts, Reddit URL for self-posts); 03-05's `.rss` switch collapsed it to permalink-only. Either way the frontend assumption was never verified. A 15-min audit closes the loop.

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

**Status (2026-05-14): PARTLY SUPERSEDED by `.planning/phases/03-caching-refresh-hardening/03-05-PLAN.md`.** The tripwire fired early — Vercel runtime logs already show `[reddit] Non-200 ... 403 Blocked` on all 5 subreddits (100% failure rate, far past the 20% escalation bar). Rather than wait for 2026-05-20, 03-05 proactively switches the Reddit fetcher to the `.rss` (Atom) feed. The OAuth escalation described below is now the **documented fallback** if `.rss` is also 403'd from Vercel's IPs (the unverified D7 risk in 03-05). Keep this entry until 03-05 ships and the verify-on-deploy result is in: `.rss` works → close this; `.rss` also blocked → execute the OAuth step below.

**What:** 7-day post-ship monitor on the Reddit anonymous JSON path. Re-check on or before **2026-05-20**.

**Why:** Reddit has been actively flagging cloud-provider egress IPs since 2023 — Vercel function IPs occasionally get 403'd regardless of volume. The shipped path (commits `66b04aa` + `b404c97`) uses anonymous fetch with a single retry on 429/503; if Reddit blanket-blocks the Vercel IP range, the per-subreddit `Promise.allSettled` keeps the cron running but the cache empties out silently.

**How to check:**
1. `vercel logs --scope <scope> --since 7d ai-dashboard-git-develop-<...>.vercel.app | grep '\[reddit\]'`
2. Count `[reddit] Non-200 response` lines and divide by total subreddit fetches in the window (5 subs × ~96 ticks/day × 7 days ≈ 3360).
3. **If failure rate > 20%** (i.e. >672 hits in the 7-day window), escalate to authenticated Reddit OAuth: register an app at https://reddit.com/prefs/apps, add `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_USERNAME` / `REDDIT_PASSWORD` env vars, exchange for a bearer token before fetch. OAuth bumps the rate limit to 100/min and is still free.

**Depends on:** `b404c97` (Reddit JSON path) deployed and running for ~7 days without rollback.

**Pros:** Catches IP-blocklist regressions before they cascade into a stale Reddit widget. **Cons:** 5-min manual check.

---

## Cache failure metadata — surface *why* a source is stale

**Source:** `/plan-eng-review` (2026-05-14), Lever 2 — surfaced as a cheap win, not selected into `03-05-PLAN.md`

**What:** Track per-source failure metadata (`lastAttemptAt`, `lastError`, `consecutiveFailures`) so a degraded source is distinguishable from a healthy-but-old one.

**Why:** Today `cacheSet`'s empty-array guard (`lib/cache/helpers.ts:29`) skips failed writes *silently* — a 403ing source looks identical to a fresh one that just hasn't ticked. The read endpoints can't tell the UI *why* data is stale, only that it is. After 03-05 lowers the hard TTL to 4h, 503s become a routine state, so being able to explain them (and alert on them) matters more.

**Pros:** UI can say "Reddit feed down — showing data from Xh ago" instead of a generic "outdated" badge; enables alerting when consecutive failures cross a threshold; turns silent degradation into a visible signal.
**Cons:** Adds a small sidecar key (or extra wrapper fields) per source; touches `cacheSet`, the read routes' `ApiResponse` shape, `useApiData`, and the widget props.

**How to do it:** On a failed/empty fetch, write a small sidecar record (e.g. `<key>:meta`) with `lastAttemptAt` / `lastError` / `consecutiveFailures`; reset it on a successful write. Expose it through the read routes' `ApiResponse`, thread it through `useApiData` → widget props, render it in `WidgetCard`.

**Depends on:** Nothing hard. Cleaner to land *after* 03-05 ships so the 4h-TTL behavior is the baseline it builds on.

---

## Per-source hard-refresh endpoint

**Source:** `/plan-eng-review` (2026-05-14), Lever 3 — surfaced as a cheap win, not selected into `03-05-PLAN.md`

**What:** Add `?source=<name>&force=1` support to `GET /api/cron/refresh` so a single source can be force-refetched on demand, bypassing the empty-array write guard.

**Why:** Today `GET /api/cron/refresh` refreshes *all* sources; there's no way to re-pull just one (e.g. right after fixing a fetcher) or to force a write past the empty-array guard when you know a source is back. The original request that drove 03-05 explicitly named "hard refresh" as a goal — this is the piece of it that 03-05 didn't include.

**Pros:** Targeted recovery without waiting for the 15-min QStash cron; a useful operational lever during incidents; small and additive.
**Cons:** New query-param surface on an authed endpoint — must keep the same Bearer/QStash gating; the `force` path past the empty-guard has to be deliberate (it must never let a fetcher write `[]` over good data by accident).

**How to do it:** Parse `source` + `force` in the GET handler; map `source` to the single fetcher; pass an `allowEmpty`-style flag through `cacheSet` only when `force=1` AND the fetcher returned non-empty. Reject unknown `source` values.

**Depends on:** Nothing hard. Small, additive — independent of 03-05.

---

*This file is the canonical home for deferred work. When picking up an item: link the PR back to the section so context isn't lost.*
