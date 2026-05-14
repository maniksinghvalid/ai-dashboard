---
phase: 3
slug: caching-refresh-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already bootstrapped in Phase 1) |
| **Config file** | `vitest.config.ts` (`environment: "node"`, `@/*` aliased to project root) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~10–20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npx tsc --noEmit && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Populated by the planner / Nyquist pass once PLAN.md task IDs exist. Anchored to the 5 ROADMAP success criteria.

| Task ID | Plan | Wave | Success Criterion | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-xx | 01 | — | SC-1 `cacheSet` boolean + truthful summary | — | `cacheSet([])` → `false`; YouTube empty path → `skipped_empty` | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-02-xx | 02 | — | SC-2 distributed cron lock | T-3-0x | Contended acquire → early return, no tier runs | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-03-xx | 03 | — | SC-3 atomic sentiment budget | — | Second concurrent consumer rejected; total ≤ budget | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-04-xx | 04 | — | SC-4 dead Vercel cron removed | — | `vercel.json` has no `crons` entry | check | `grep -c '"crons"' vercel.json` | n/a | ⬜ pending |
| — | — | — | SC-5 suite green | — | type + lint + tests clean | suite | `npm test && npx tsc --noEmit && npm run lint` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · W0 = file created in Wave 0*

---

## Wave 0 Requirements

- [ ] Test file(s) for the `cacheSet` boolean contract (SC-1) — write/extend alongside `lib/cache/helpers.ts`
- [ ] Test file for the cron lock helper (SC-2) — acquire-success / acquire-contended / release
- [ ] Test file / cases for the atomic sentiment budget guard (SC-3) — second concurrent consumer rejected
- [ ] Test for the pure summary-derivation function (SC-1 cron half) — keeps it a normal unit test, no route-handler harness needed

*Vitest itself is already installed (Phase 1) — no framework install needed. The Redis-boundary mock pattern (`vi.mock("@/lib/cache/redis")`) is established in `lib/cache/timeseries.test.ts` and `lib/api/alerts.test.ts`.*

---

## Manual-Only Verifications

| Behavior | Success Criterion | Why Manual | Test Instructions |
|----------|-------------------|------------|-------------------|
| Concurrent QStash-retry returns early in production | SC-2 | Requires two overlapping real cron invocations against the deployed function; unit test covers the lock helper, but the end-to-end concurrency is observed via logs | After deploy, inspect Vercel logs around a QStash retry window for the `{ status: "locked" }` early-return body; confirm no duplicate tier execution |
| Vercel cron dashboard no longer shows false-green | SC-4 | Vercel's cron dashboard state is external; can only be observed in the Vercel UI | After deploy, confirm the Vercel project's Cron tab no longer lists the removed daily job |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
