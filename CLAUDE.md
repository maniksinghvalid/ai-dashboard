# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AIP-Dash (AI Pulse Live Dashboard) — a real-time AI industry dashboard that aggregates data from YouTube, Reddit, and X/Twitter APIs, cached via Upstash Redis. Built on Next.js 14 App Router with TypeScript.

## Commands

- `npm run dev` — start dev server (localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint with Prettier compatibility
- No test framework configured yet

## Architecture

- **Next.js 14 App Router** — flat `/app` directory (no `src/`), import alias `@/*`
- **`app/api/health/route.ts`** — Redis health check (`GET /api/health`), uses `force-dynamic`
- **`app/api/cron/refresh/route.ts`** — Data refresh endpoint. `GET` requires `Authorization: Bearer $CRON_SECRET` (Vercel daily cron). `POST` accepts QStash signed requests (15-min intervals).
- **`app/api/youtube|reddit|x|trending|news/route.ts`** — Read-only cache endpoints, return cached data with stale fallback (503 if no data)
- **`app/global-error.tsx`** — Sentry-integrated error boundary. Uses inline styles intentionally (Tailwind may not load during errors).
- **`lib/cache/redis.ts`** — Upstash Redis client, lazy-initialized via `getRedis()` (not top-level) to avoid build-time env var validation errors
- **`lib/cache/helpers.ts`** — `cacheGet()` / `cacheSet()` with application-level freshness checking and stale fallback
- **`lib/api/`** — API client modules: `youtube.ts` (googleapis), `reddit.ts` (apify-client), `twitter.ts` (X API v2 fetch), `news.ts` (rss-parser), `trending.ts` (cross-platform keyword engine)
- **`lib/types.ts`** — Shared types: `Video`, `RedditPost`, `Tweet`, `NewsItem`, `TrendingTopic`, `CachedData<T>`
- **`lib/constants.ts`** — Channel IDs, subreddits, Twitter users, RSS feeds, cache keys/TTLs
- **`components/widgets/`** — dashboard widget components (placeholder)

## Key Patterns

- **Redis client**: Always use `getRedis()` from `@/lib/cache/redis`, never instantiate `new Redis()` directly. The lazy init pattern is required because Upstash validates URLs at construction time, which breaks `next build` when env vars aren't set.
- **Sentry init**: All three Sentry configs (`instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) guard with `if (process.env.NEXT_PUBLIC_SENTRY_DSN)` before calling `Sentry.init()`. Keep this pattern — it prevents noisy warnings in local dev without a DSN.
- **Sentry sample rates**: `tracesSampleRate` is env-configurable via `SENTRY_TRACES_SAMPLE_RATE` (server/edge) and `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (client). Set to `0.1–0.2` for production.
- **Dark theme**: Tailwind `darkMode: "class"` with `className="dark"` on `<html>`. Default background is `#0b1120`. Custom design tokens in `tailwind.config.ts`: `accent-*` (cyan palette), `surface-*` colors, `widget-*` spacing/typography/border-radius.

## Environment Variables

See `.env.example` for all variables. Required: `YOUTUBE_API_KEY`, `APIFY_API_TOKEN`, `X_BEARER_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`. Optional: `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.

## Git Workflow

- Working branch: `develop`. PRs merge `develop → main`.
- Jira project key: `SCRUM` (epic: SCRUM-27 "AIP-Dash")

## Deployment

Vercel with daily cron at `/api/cron/refresh` (configured in `vercel.json`). Hobby plan restricts crons to once per day — use Upstash QStash for 15-min intervals via the POST handler. `SENTRY_AUTH_TOKEN` is optional — builds succeed without it (source map upload silently skips).
