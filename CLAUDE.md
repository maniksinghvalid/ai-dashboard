# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AIP-Dash (AI Pulse Live Dashboard) — a real-time AI industry dashboard that aggregates data from YouTube, Reddit, and X/Twitter APIs, cached via Upstash Redis. Built on Next.js 14 App Router with TypeScript.

## Commands

- `npm run dev` — start dev server (localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint with Prettier compatibility
- `npm test` — run Vitest unit tests (pure-function core)
- `npm run test:watch` — Vitest in watch mode
- `npm run test:coverage` — Vitest with v8 coverage

## Architecture

- **Next.js 14 App Router** — flat `/app` directory (no `src/`), import alias `@/*`
- **`app/layout.tsx`** — Root layout. Forces `<html className="dark">` (dark theme is always on) and loads DM Sans + Space Mono via `next/font/google` exposed as CSS vars `--font-dm-sans` / `--font-space-mono`.
- **`app/api/cron/refresh/route.ts`** — Data refresh endpoint. `GET` requires `Authorization: Bearer $CRON_SECRET` (Vercel daily cron). `POST` accepts QStash signed requests (15-min intervals).
- **`app/api/youtube|reddit|x|trending|news/route.ts`** — Read-only cache endpoints, return cached data with stale fallback (503 if no data)
- **`app/api/health/route.ts`** — Redis health check (`GET /api/health`), uses `force-dynamic`
- **`app/global-error.tsx`** — Sentry-integrated error boundary. Uses inline styles intentionally (Tailwind may not load during errors).
- **`lib/cache/redis.ts`** — Upstash Redis client, lazy-initialized via `getRedis()` (not top-level) to avoid build-time env var validation errors
- **`lib/cache/helpers.ts`** — `cacheGet()` / `cacheSet()` with application-level freshness checking and stale fallback
- **`lib/api/`** — API client modules: `youtube.ts` (googleapis), `reddit.ts` (apify-client), `twitter.ts` (X API v2 fetch), `news.ts` (rss-parser), `trending.ts` (cross-platform keyword engine)
- **`lib/types.ts`** — Shared types: `Video`, `RedditPost`, `Tweet`, `NewsItem`, `TrendingTopic`, `HeroStory`, `CachedData<T>`, `ApiResponse<T>`
- **`lib/constants.ts`** — Channel IDs, subreddits, Twitter users, RSS feeds, cache keys/TTLs
- **`lib/utils/format.ts`** — Shared utilities: `formatRelativeTime()` — single source of truth for all relative time formatting across widgets
- **`lib/hooks/use-dashboard.ts`** — `useDashboard()` hook: fetches all dashboard data sources via SWR, returns `{ youtube, reddit, twitter, news, trending, sentiment, hero }` each with `{ data, stale, isLoading, error }`
- **`lib/hooks/use-api-data.ts`** — `useApiData<T>()`: generic SWR wrapper for `/api/*` endpoints, handles `ApiResponse<T>` shape

### Frontend Component Architecture

- **`components/DashboardShell.tsx`** — Client component (`"use client"`), orchestrates the full dashboard layout. Uses `useDashboard()` to fetch data, wraps each widget in `WidgetErrorBoundary`, and lays out the grid: `lg:grid-cols-2 xl:grid-cols-[280px_1fr_280px]`.
- **Widget pattern**: Each data widget (YouTube, Reddit, X, Trending, News, Sentiment) accepts `{ data, stale, isLoading, error }` props, renders via `WidgetCard` (with `icon` / `iconBg` / `title` / `badge?` / `stale?`), and handles loading/error/empty states internally. `WidgetErrorBoundary` (class component, reports to Sentry) wraps each widget in `DashboardShell`.
- **Exceptions to the pattern**:
  - `HeroStoryCard` does NOT use `WidgetCard` — it has a custom gradient layout and derives its content from trending + youtube + news via `deriveHeroStory()`.

## Key Patterns

- **Redis client**: Always use `getRedis()` from `@/lib/cache/redis`, never instantiate `new Redis()` directly. The lazy init pattern is required because Upstash validates URLs at construction time, which breaks `next build` when env vars aren't set.
- **Sentry init**: All three Sentry configs (`instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) guard with `if (process.env.NEXT_PUBLIC_SENTRY_DSN)` before calling `Sentry.init()`. Keep this pattern — it prevents noisy warnings in local dev without a DSN.
- **Sentry sample rates**: `tracesSampleRate` is env-configurable via `SENTRY_TRACES_SAMPLE_RATE` (server/edge) and `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (client). Set to `0.1–0.2` for production.
- **Dark theme**: Tailwind `darkMode: "class"` with `className="dark"` on `<html>`. CSS variables defined in `globals.css` (e.g., `--surface`, `--border`, `--accent`, `--muted`). Tailwind config extends with: `accent-*` (purple palette, primary `#7c6eff`), `accent-secondary` (`#c084fc`), `platform-*` (YouTube/Reddit/X), `surface` (`#0d0d1f`), `surface-2` (`#13132b`), `green`/`red`/`amber` (status colors, override Tailwind defaults), `muted` (`#6b668a`), `border` (accent-tinted). Fonts: DM Sans (body) + Space Mono (monospace labels) via `next/font/google`.
- **next/image domains**: `next.config.mjs` allows `i.ytimg.com`, `i1.ytimg.com`, `img.youtube.com` for YouTube thumbnails.
- **Shared utilities**: Time formatting lives in `lib/utils/format.ts`. Do not duplicate `formatRelativeTime` in widget files.
- **SWR defaults**: `useApiData` polls every 60s, dedupes within 10s, disables `revalidateOnFocus`, retries 3 times. New hooks fetching `/api/*` data should reuse `useApiData` rather than calling `useSWR` directly — override the `refreshInterval` arg if a widget genuinely needs a different cadence.
- **Tailwind color overrides**: `green`, `red`, `amber` in `tailwind.config.ts` override the full Tailwind scale (only DEFAULT/400/500 defined). Do not use shades like `green-100` or `red-600` — they don't exist. If the full palette is needed, namespace as `brand-green` etc.
- **New widgets**: Follow the existing pattern — accept `{ data, stale, isLoading, error }` props, use `WidgetCard` with `icon`/`iconBg`/`title`/`badge`, handle loading/error/empty states, wrap in `WidgetErrorBoundary` in `DashboardShell`.
- **Cron summary truthfulness**: the four Tier 1 keys (`youtube`, `reddit`, `twitter`, `news`) in `/api/cron/refresh`'s `summary` are three-state via `deriveSourceOutcome` (`lib/cron/summary.ts`): `written` (fetcher resolved with a non-empty array — real cache write), `skipped_empty` (fetcher resolved but returned `[]`, so `cacheSet`'s empty-array guard skipped the write OR the fetcher early-returned `[]`), `fetcher_threw` (the fetcher promise rejected). An all-upstreams-empty run therefore reports `skipped_empty` per source instead of an all-green `ok`. `cacheSet` itself returns a `boolean` (`true` = wrote, `false` = empty-array guard skipped the write). Tier 2/3 keys (`trending`, `hero`, `alerts`, `sentiment`) remain binary `ok`/`failed`. Still grep runtime logs for `[cache] skipping empty write` and `[<source>] ... rejected|Non-200` for the underlying cause.
- **YouTube cache-skip blind spot (now surfaced)**: `fetchYouTubeVideos` has two pre-`cacheSet` early returns — the no-API-key `return []` and the `videoIds.length === 0` `return []` — both return `[]` before `cacheSet` runs, so a `cacheSet` boolean alone can't catch them. The cron's `deriveSourceOutcome` re-derives `skipped_empty` from `(fulfilled) && (empty array)` uniformly across all four Tier 1 sources, so an all-playlist-rejected YouTube run now shows `youtube: "skipped_empty"` in the summary. The `[youtube] playlist fetch rejected` warn still pinpoints which playlists failed.

## Environment Variables

See `.env.example` for all variables. Required: `YOUTUBE_API_KEY`, `APIFY_API_TOKEN`, `X_BEARER_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `TOGETHER_API_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`. Optional: `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`, `SENTIMENT_DAILY_CHAR_BUDGET` (default 200000), `REDDIT_USER_AGENT` (override Reddit JSON User-Agent string; defaults to `aip-dash/1.0 (https://github.com/maniksinghvalid/ai-dashboard)`), `VERCEL_AUTOMATION_BYPASS_SECRET` (auto-set by Vercel when Protection Bypass for Automation is enabled — see Deployment Protection below).

## Git Workflow

- Working branch: `develop`. PRs merge `develop → main`.
- Jira project key: `SCRUM` (epic: SCRUM-27 "AIP-Dash")

## Deployment

Refresh is driven solely by Upstash QStash's 15-minute POST schedule against `/api/cron/refresh`. The Vercel daily `crons` entry has been removed from `vercel.json` (see "Practical implication" below for why) — `vercel.json` is now an empty object. `SENTRY_AUTH_TOKEN` is optional — builds succeed without it (source map upload silently skips).

### Deployment Protection (Vercel Authentication)

This project runs with Vercel Authentication enabled (Settings → Deployment Protection). The Vercel edge returns 401 with an HTML "Authentication Required" page (and a `_vercel_sso_nonce` cookie) to unauthenticated callers — **before** the route handler runs. The cron route's `Authorization: Bearer $CRON_SECRET` check is correct but unreachable from outside without bypassing the edge first.

To allow programmatic access, **Protection Bypass for Automation** is enabled in the same settings page. Vercel auto-injects the secret as the system env var `VERCEL_AUTOMATION_BYPASS_SECRET`. Callers must include header `x-vercel-protection-bypass: <secret>` (or `?x-vercel-protection-bypass=<secret>` query param for systems that can't set headers — `CRON_SECRET` is still verified by the route, so leaking the bypass alone doesn't authorize a cron run).

**Bypass interactions per caller:**

| Caller | Path | Edge bypass | App-level auth |
|---|---|---|---|
| Upstash QStash (15-min schedule) | POST `/api/cron/refresh` | Query param on the schedule's destination URL: `?x-vercel-protection-bypass=<secret>`. The QStash console doesn't surface a custom-headers field on schedules, so the query-param form (Vercel's documented fallback for "tools that cannot set custom headers") is the transport. | QStash signature (`upstash-signature`) verified in route via `QSTASH_*_SIGNING_KEY`. The route calls `Receiver.verify({ signature, body })` without passing `url`, so the added query string does not disturb signature verification. |
| Manual `curl` against the deployed URL | GET `/api/cron/refresh` | Header: `-H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET"` | `-H "Authorization: Bearer $CRON_SECRET"` |
| Manual `curl` against local dev | GET `/api/cron/refresh` | Not applicable (no Vercel edge locally) | `-H "Authorization: Bearer $CRON_SECRET"` |
| Vercel built-in scheduled cron (`vercel.json` `crons`) | — | **Removed.** There is no longer a `crons` entry in `vercel.json` (see "Practical implication" below). Vercel's `crons` config supports only `path` + `schedule` — no way to send custom headers or query params — so it could never get past the edge under Deployment Protection. | n/a — no longer configured. |

Practical implication: the QStash 15-min POST is the only path that actually refreshes data under protection. The Vercel daily `crons` entry has been **removed** from `vercel.json`: under Deployment Protection the Vercel edge 401s the cron invocation before it ever reaches the route handler, and Vercel's cron dashboard reports that edge 401 as a *successful* run — a false-green that is actively misleading during incident response. Refresh now relies solely on QStash.

**Security trade-off for QStash query-param transport**: the bypass secret will appear in Vercel function logs, Upstash request history, and Sentry breadcrumbs (Sentry captures `request.url` by default). Defense in depth still applies — leaking the bypass alone does NOT authorize a refresh; the QStash signature on the request body (POST) and `CRON_SECRET` (GET) gate the actual work at the application layer. The bypass only gets past Vercel's edge protection. Rotate the bypass periodically: regenerate in Vercel dashboard → redeploy (so the new value is baked in) → update the QStash schedule URL with the new secret.

When rotating the bypass secret in Vercel, **redeploy** — the secret is baked into deployments at build time, so old deployments keep the old value and will 401 for new callers.

**Stable QStash target**: point the QStash schedule at the develop branch alias `https://ai-dashboard-git-develop-maniks-projects-b7b7b384.vercel.app/api/cron/refresh?x-vercel-protection-bypass=<secret>` — Vercel auto-points this at the latest successful develop deploy, so the schedule survives redeploys. Pinning to a deployment-hash URL strands silently on every new build.

**Diagnostic — what kind of 401**: HTML body with "Authentication Required" = Vercel edge rejected (missing/wrong bypass). JSON body `{"error":"Unauthorized"}` = route's own auth check (you got past the edge — good signal).

## Local-only directories

The following directories are gitignored or untracked tooling output — safe to ignore when reasoning about the app: `arch/`, `playwright-qa-screenshots/`, `.develop-team/`, `.review-fix/`, `.review-team/`, `.claude/worktrees/`.

## gstack

For all web browsing, use the `/browse` skill from gstack. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.
