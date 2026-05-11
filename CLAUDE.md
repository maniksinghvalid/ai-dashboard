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
- **`lib/hooks/use-dashboard.ts`** — `useDashboard()` hook: fetches all 5 data sources via SWR, returns `{ youtube, reddit, twitter, news, trending }` each with `{ data, stale, isLoading, error }`
- **`lib/hooks/use-api-data.ts`** — `useApiData<T>()`: generic SWR wrapper for `/api/*` endpoints, handles `ApiResponse<T>` shape

### Frontend Component Architecture

- **`components/DashboardShell.tsx`** — Client component (`"use client"`), orchestrates the full dashboard layout. Uses `useDashboard()` to fetch data, wraps each widget in `WidgetErrorBoundary`, and lays out the grid: `lg:grid-cols-2 xl:grid-cols-[280px_1fr_280px]`.
- **Widget pattern**: Each data widget (YouTube, Reddit, X, Trending, News) accepts `{ data, stale, isLoading, error }` props, renders via `WidgetCard` (with `icon` / `iconBg` / `title` / `badge?` / `stale?`), and handles loading/error/empty states internally. `WidgetErrorBoundary` (class component, reports to Sentry) wraps each widget in `DashboardShell`.
- **Exceptions to the pattern**:
  - `HeroStoryCard` does NOT use `WidgetCard` — it has a custom gradient layout and derives its content from trending + youtube + news via `deriveHeroStory()`.
  - `SentimentWidget` is a visual placeholder with hardcoded sample data (no API backend yet).

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

## Environment Variables

See `.env.example` for all variables. Required: `YOUTUBE_API_KEY`, `APIFY_API_TOKEN`, `X_BEARER_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `TOGETHER_API_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`. Optional: `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`, `SENTIMENT_DAILY_CHAR_BUDGET` (default 200000).

## Git Workflow

- Working branch: `develop`. PRs merge `develop → main`.
- Jira project key: `SCRUM` (epic: SCRUM-27 "AIP-Dash")

## Deployment

Vercel with daily cron at `/api/cron/refresh` (configured in `vercel.json`, schedule `0 0 * * *` UTC). Hobby plan restricts crons to once per day — use Upstash QStash for 15-min intervals via the POST handler. `SENTRY_AUTH_TOKEN` is optional — builds succeed without it (source map upload silently skips).

## Local-only directories

The following directories are gitignored or untracked tooling output — safe to ignore when reasoning about the app: `arch/`, `playwright-qa-screenshots/`, `.develop-team/`, `.review-fix/`, `.review-team/`, `.claude/worktrees/`.

## gstack

For all web browsing, use the `/browse` skill from gstack. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.
