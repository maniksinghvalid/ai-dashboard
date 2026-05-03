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
- **`app/api/`** — API routes (health check, cron refresh)
- **`lib/cache/redis.ts`** — Upstash Redis client, lazy-initialized via `getRedis()` (not top-level) to avoid build-time env var validation errors
- **`lib/api/`** — API client modules for YouTube, Reddit, X/Twitter (placeholder)
- **`components/widgets/`** — dashboard widget components (placeholder)
- **`vercel.json`** — Vercel Cron config, daily schedule (Hobby plan limitation)

## Key Patterns

- **Redis client**: Always use `getRedis()` from `@/lib/cache/redis`, never instantiate `new Redis()` directly. The lazy init pattern is required because Upstash validates URLs at construction time, which breaks `next build` when env vars aren't set.
- **Cron endpoint**: `app/api/cron/refresh/route.ts` requires `Authorization: Bearer $CRON_SECRET` header.
- **Dark theme**: Tailwind `darkMode: "class"` with `className="dark"` on `<html>`. Default background is `#0b1120`. Custom design tokens: `accent-*` (cyan palette), `surface-*` colors, `widget-*` spacing/typography/border-radius.

## Environment Variables

See `.env.example` for all 11 variables: YouTube, Reddit, X/Twitter API keys, Upstash Redis credentials, CRON_SECRET, Sentry DSN/auth token, and optional Sentry org/project overrides.

## Deployment

Vercel with daily cron at `/api/cron/refresh`. Hobby plan restricts crons to once per day.
