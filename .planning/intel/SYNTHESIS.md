# Synthesis Summary

Entry point for `gsd-roadmapper`. Single-doc ingest of `arch/precious-leaping-wren.md` (SPEC) for SCRUM-38.

---

## Doc counts

- **Total docs synthesized**: 1
- **By type**: SPEC × 1 (ADR 0, PRD 0, DOC 0)
- **Confidence**: high (manifest-pinned)

## Decisions locked

**11 total** — captured in `.planning/intel/decisions.md`. All treated as LOCKED per ingest instructions (embedded `/plan-eng-review` review report explicitly "locks in" each row).

- **D1** — Paid sentiment provider + budget cap (drop HF Serverless)
- **D2** — One ZSET per `(topic, platform)`, 96-slot cap; no snapshot rotation
- **D3** — Hero threshold: top-3 on all 3 platforms (ranked by aggregate velocity)
- **D4** — Cron three-tier sequenced DAG with `Promise.allSettled` per tier
- **D5** — `lib/topics.ts` typed shape with aliases + optional `wordBoundary`
- **D6** — Vitest + 5 unit-test files; pure-function core only
- **D7** — Together AI as sentiment provider (`TOGETHER_API_KEY`)
- **F1** — `.env.example`: add `TOGETHER_API_KEY` + `SENTIMENT_DAILY_CHAR_BUDGET`; drop `HUGGINGFACE_API_TOKEN`
- **F2** — `preprocessText()` for cardiffnlp model (replace `@username`, URLs)
- **F3** — `export const maxDuration = 30` in `app/api/cron/refresh/route.ts`
- **F4** — Scope-trip risk acknowledged; alerts cleanly separable as fallback

**Source for all**: `arch/precious-leaping-wren.md` (GSTACK REVIEW REPORT)

## Requirements extracted

**10 total** — captured in `.planning/intel/requirements.md`:

- `REQ-sentiment-engine` — Together AI batch sentiment, `GET /api/sentiment`, 5s budget
- `REQ-trending-velocity` — true velocity ranking via ZSET windows
- `REQ-topic-taxonomy` — `lib/topics.ts` typed taxonomy (D5)
- `REQ-hero-auto-promotion` — top-3-on-all-3 cross-platform hero, `GET /api/hero`
- `REQ-spike-alerts` — `alerts:spikes` LPUSH+LTRIM at 5× velocity baseline
- `REQ-sentiment-widget-polish` — drop placeholder, render live data, polish per gate-2 mockup
- `REQ-cron-three-tier-dag` — 3-tier DAG + `maxDuration = 30`
- `REQ-vitest-bootstrap` — first test framework: Vitest + 5 test files + scripts
- `REQ-dashboard-data-wiring` — wire sentiment + hero into `useDashboard`
- `REQ-env-contract` — env vars + CLAUDE.md updates

## Constraints

**13 total** — captured in `.planning/intel/constraints.md`. Type breakdown:

- **api-contract** (6): `CON-cardiffnlp-preprocessing`, `CON-timeseries-api`, `CON-hero-relaxation-disclosure`, `CON-cron-dag-tiers`, `CON-redis-client`, `CON-swr-wrapper`
- **schema** (1): `CON-trending-storage-shape`
- **nfr** (6): `CON-hf-quota-budget`, `CON-vercel-max-duration`, `CON-alerts-spikes-cap`, `CON-sentiment-5s-budget`, `CON-scope-trip-risk`, `CON-key-rotation-observability`

## Context topics

**1 SPEC** distilled to project background — captured in `.planning/intel/context.md`:

- Project identity (AIP-Dash, Next.js 14 + TS + Upstash + Sentry + Vercel)
- Jira: epic SCRUM-27, active ticket SCRUM-38, predecessors SCRUM-36 + SCRUM-37 shipped
- User pre-planning decisions (visual polish; alerts bundled; manual gates)
- The 9-step gstack workflow — flagged as informational, **only gate 3 (Implementation) maps to a GSD phase** per ingest scope
- Full SCRUM-38 file inventory (5 new modules, 8 extended files, 7 test files)

## Conflicts

- **0 blockers**
- **0 competing variants**
- **0 auto-resolved**
- Detail: `.planning/INGEST-CONFLICTS.md`
- Cause: single-doc ingest; no cross-doc contradictions possible. No `UNKNOWN`-confidence classifications. No cyclic cross-refs.

## Pointers

- Decisions → `.planning/intel/decisions.md`
- Requirements → `.planning/intel/requirements.md`
- Constraints → `.planning/intel/constraints.md`
- Context → `.planning/intel/context.md`
- Conflicts → `.planning/INGEST-CONFLICTS.md`

## Roadmapper hints (non-binding)

- **Single phase recommended**: "SCRUM-38 Implementation" (gate 3 only per ingest scope). QA/benchmark/review/ship/land-and-deploy/canary are gstack skills, not GSD phases.
- **Suggested in-phase ordering** mirrors the SPEC's natural dependency order:
  1. Test infrastructure (D6, REQ-vitest-bootstrap) — unblocks everything else
  2. Topic taxonomy (REQ-topic-taxonomy) — pure data, prerequisite for trending refactor
  3. Time-series wrapper (`lib/cache/timeseries.ts` — pre-req for trending + alerts)
  4. Trending velocity refactor (REQ-trending-velocity) — consumer of items 2-3
  5. Spike alerts (REQ-spike-alerts) — consumer of item 3, hooks into item 4
  6. Sentiment engine + route (REQ-sentiment-engine) — independent leg
  7. Hero promoter + route (REQ-hero-auto-promotion) — consumer of items 2-4
  8. Cron 3-tier DAG (REQ-cron-three-tier-dag) — orchestrates 4/5/6/7
  9. Dashboard wiring (REQ-dashboard-data-wiring) — frontend consumes 6/7
  10. Sentiment widget polish (REQ-sentiment-widget-polish) — gated on gate-2 mockup committed under `arch/`
  11. Env contract + CLAUDE.md updates (REQ-env-contract)
- **Fallback policy** (CON-scope-trip-risk / F4): if friction surfaces, alerts (REQ-spike-alerts + its slice of `lib/cache/timeseries.ts`) split cleanly to a follow-up PR. Roadmapper may surface this as an explicit decision point.
