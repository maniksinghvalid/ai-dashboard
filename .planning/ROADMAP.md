# Project Roadmap

## Shipped Milestones

- **v1.0 — AIP-Dash AI Pulse Live Dashboard** ✅ SHIPPED 2026-05-14 — 4 phases, 25 plans, intelligence layer + reddit free fallback + cron hardening + scrollable feeds. See [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full detail.

## Current Milestone

No active milestone. Run `/gsd-new-milestone` to seed the next version.

## Backlog (carry-over from v1.0)

These items were explicitly deferred at v1.0 close and are candidates for v1.1 planning:

1. **Cron tier-restructure** — sentiment leg's 35s timeout vs 60s function ceiling has thin headroom. Carry to v1.1 as a timeout-tuning / tier-restructure phase.
2. **Stale upstream death monitoring** — per-source freshness probe + Sentry alerting + dashboard staleness UI. Stale-fallback currently masks permanently dead upstreams.
3. **Reddit OAuth tripwire** — if `[reddit] Non-200` rate in prod exceeds 20% on the 2026-05-20 calendar check, escalate to authenticated Reddit OAuth (separate phase).
4. **Spike-alert consumers** — toast / email / Slack surfaces for the `alerts:spikes` Redis list. v1.0 produces events only; no consumer exists.
5. **Sentiment history view** — sparkline over hours/days. v1.0 ships the live snapshot only.
6. **Real-Firefox visual verification** — confirm the always-on thin native scrollbar from Phase 4 (only residual `human_needed` item from v1.0 verification).
7. **AIP-Dash epic backlog (Jira SCRUM-27):**
   - SCRUM-39 — Testing, QA & Performance Optimisation (Medium)
   - SCRUM-40 — Production Deployment & Go-Live (Medium)
   - SCRUM-42 — Sentiment Analysis Backend & SentimentBar Widget (High) — likely a stale dup of shipped Phase 1 work; verify before scoping.
