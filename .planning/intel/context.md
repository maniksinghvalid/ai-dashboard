# Context

Project background, ticket links, and milestones already shipped — all
derived from `arch/precious-leaping-wren.md` (Context section) and confirmed
against the repo's CLAUDE.md.

---

## Project

- **Name**: AIP-Dash — AI Pulse Live Dashboard
- **Stack**: Next.js 14 App Router + TypeScript; Upstash Redis caching; Sentry instrumentation; Vercel cron + Upstash QStash for refresh cadence
- **Theme**: dark, always on (no toggle); DM Sans + Space Mono fonts
- **Source**: arch/precious-leaping-wren.md + project CLAUDE.md

## Jira

- **Epic**: SCRUM-27 — AIP-Dash
- **Active ticket**: [SCRUM-38](https://prabhneet.atlassian.net/browse/SCRUM-38) — *AIP-Dash: Sentiment Analysis Engine & Cross-Platform Trending* (Story; depends on SCRUM-36 ✅)
- **Source**: arch/precious-leaping-wren.md (Context > Ticket line)

## Already shipped (predecessor tickets)

- **SCRUM-36** — Data layer: API client modules (`lib/api/{youtube,reddit,twitter,news,trending}.ts`), Redis caching, cron refresh skeleton. ✅ shipped.
- **SCRUM-37** — Frontend dashboard UI: shell, widget contracts, `WidgetCard` / `WidgetErrorBoundary` patterns, dark theme tokens, design-reference alignment. ✅ shipped on branch `37-frontend-dashboard-ui` (current branch).
- **Source**: arch/precious-leaping-wren.md (Context > Why now)

## Why SCRUM-38 now

The data layer (SCRUM-36) and UI shell (SCRUM-37) are in. SCRUM-38 is the **intelligence layer** that makes the dashboard feel "live" rather than a feed reader. The sentiment widget is the only widget still showing hardcoded sample data; the trending widget uses a heuristic score rather than true velocity; there is no cross-platform hero promotion and no spike-alert pathway. SCRUM-38 closes all four gaps in a single PR.

- **Source**: arch/precious-leaping-wren.md (Context > Why now)

## User decisions captured pre-planning

- **Sentiment widget**: gets visual polish alongside the data wiring → `/design-html` is in the path (gate 2). `/design-shotgun` only invoked if a layout choice arises.
- **Alert system**: bundled into this PR (not deferred), with a documented split-out fallback (see CON-scope-trip-risk).
- **Manual gates**: between each gstack step (no `/autoplan` chain).
- **Source**: arch/precious-leaping-wren.md (Context > User decisions)

## gstack workflow (informational; not GSD phases)

The SPEC describes a 9-step gstack workflow:
1. `/plan-eng-review` — locked the 7 decisions + 4 fix-its now captured in `decisions.md`. **Done.**
2. `/design-html` (sentiment widget mockup) — gate before implementation.
3. **Implementation** — the code-writing work; this is the scope of the resulting GSD roadmap phase.
4. `/qa` — Standard tier.
5. `/benchmark` — confirms the 5s sentiment budget and Core Web Vitals.
6. `/review` — pre-landing diff review.
7. `/ship` — version bump, CHANGELOG, PR open.
8. `/land-and-deploy` — merge + health checks.
9. `/canary` — 10-min post-deploy watch.

Per the ingest scope, **only gate 3 (Implementation)** maps to a GSD phase. Gates 1–2 are already represented by the locked decisions and the existing arch mockup; gates 4–9 are gstack skills with their own protocols, not phases the roadmapper should expand.

- **Source**: arch/precious-leaping-wren.md (gstack Skill Workflow table) + ingest-scope instruction from orchestrator

## Files in scope of SCRUM-38 (reference list for the roadmapper)

**New modules (5)**:
- `lib/topics.ts`
- `lib/api/sentiment.ts`
- `lib/api/alerts.ts`
- `lib/cache/timeseries.ts`
- `app/api/sentiment/route.ts`
- `app/api/hero/route.ts`

**Extended files (8)**:
- `lib/types.ts`
- `lib/constants.ts`
- `lib/api/trending.ts`
- `app/api/cron/refresh/route.ts`
- `lib/hooks/use-dashboard.ts`
- `components/widgets/SentimentWidget.tsx`
- `components/widgets/HeroStoryCard.tsx`
- `components/DashboardShell.tsx`
- `.env.example`
- `CLAUDE.md` (commands + env section)

**Test infrastructure (new)**:
- `package.json` (scripts + deps)
- `vitest.config.ts`
- `lib/topics.test.ts`
- `lib/api/sentiment.test.ts`
- `lib/api/trending.test.ts`
- `lib/api/alerts.test.ts`
- `lib/cache/timeseries.test.ts`

- **Source**: arch/precious-leaping-wren.md (Scope & Architecture + Updated file plan)

## Branching

- Working branch: `develop` (per CLAUDE.md). Current checkout is `37-frontend-dashboard-ui`; SCRUM-38 work expected on a new branch off `develop` (e.g., `scrum-38`) per gstack `/ship` step.
- **Source**: arch/precious-leaping-wren.md (gstack step 7) + project CLAUDE.md
