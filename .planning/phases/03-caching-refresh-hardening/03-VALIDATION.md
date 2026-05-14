---
phase: 3
slug: caching-refresh-hardening
status: draft
nyquist_compliant: true
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
| 03-01 Task 1 — cacheSet returns a write boolean | 01 | 1 | SC-1 `cacheSet` boolean contract | T-3-01..03 | `cacheSet([])` → `false`; real write → `true` | unit | `npx vitest run lib/cache/helpers.test.ts` | planned in 03-01 (W0) | ⬜ pending |
| 03-01 Task 2 — pure deriveSourceOutcome helper | 01 | 1 | SC-1 truthful three-state summary | T-3-02 | rejected→`fetcher_threw`, empty→`skipped_empty`, nonempty→`written` | unit | `npx vitest run lib/cron/summary.test.ts` | planned in 03-01 (W0) | ⬜ pending |
| 03-01 Task 3 — thread three-state outcome into cron summary + CLAUDE.md | 01 | 1 | SC-1 YouTube empty path → `skipped_empty` | T-3-01 | all-upstreams-empty run → zero `written` entries | suite | `npx tsc --noEmit && npm run lint && npm test` | n/a (modifies route.ts) | ⬜ pending |
| 03-02 Task 1 — add cronLock key to CACHE_KEYS | 02 | 2 | SC-2 distributed cron lock (key) | — | `CACHE_KEYS.cronLock` exists | check | `npx tsc --noEmit && grep -c 'cronLock' lib/constants.ts` | n/a (modifies constants.ts) | ⬜ pending |
| 03-02 Task 2 — extract lib/cache/lock.ts (acquire/release) | 02 | 2 | SC-2 distributed cron lock (helper) | T-3-04..06 | acquire-success, acquire-contended → `null`, value-checked release | unit | `npx vitest run lib/cache/lock.test.ts` | planned in 03-02 (W0) | ⬜ pending |
| 03-02 Task 3 — wrap refreshAllFeeds in the lock | 02 | 2 | SC-2 contended invocation returns early | T-3-05, T-3-06 | contended → HTTP 200 `{status:"locked"}`, no tier runs | suite | `npx tsc --noEmit && npm run lint && npm test` | n/a (modifies route.ts) | ⬜ pending |
| 03-03 Task 1 — add atomic budget guard tests (RED) | 03 | 1 | SC-3 atomic sentiment budget (spec) | T-3-10 | single consumer passes; concurrent second consumer rejected | unit | `npx tsc --noEmit && npx vitest run lib/api/sentiment.test.ts` | planned in 03-03 (W0) | ⬜ pending |
| 03-03 Task 2 — make checkAndConsumeBudget atomic via redis.eval (GREEN) | 03 | 1 | SC-3 atomic sentiment budget (impl) | T-3-08, T-3-10 | second concurrent consumer rejected; total ≤ budget | unit | `npx tsc --noEmit && npm run lint && npx vitest run lib/api/sentiment.test.ts` | n/a (modifies sentiment.ts) | ⬜ pending |
| 03-04 Task 1 — remove crons entry from vercel.json | 04 | 1 | SC-4 dead Vercel cron removed | T-3-12 | `vercel.json` has no `crons` entry, still valid JSON | check | `grep -c '"crons"' vercel.json` (expect 0) | n/a (modifies vercel.json) | ⬜ pending |
| 03-04 Task 2 — tighten CLAUDE.md Deployment prose | 04 | 1 | SC-4 docs match QStash-only refresh | T-3-12 | `false-green` explained; QStash sole refresh path | check | `grep -ci 'false.green' CLAUDE.md` (expect ≥1) | n/a (modifies CLAUDE.md) | ⬜ pending |
| — phase gate — | all | — | SC-5 suite green | — | type + lint + tests clean | suite | `npm test && npx tsc --noEmit && npm run lint` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · W0 = file created in Wave 0*

---

## Wave 0 Requirements

- [x] Test file for the `cacheSet` boolean contract (SC-1) — `lib/cache/helpers.test.ts`, planned as a new file in **03-01 Task 1**
- [x] Test file for the cron lock helper (SC-2) — `lib/cache/lock.test.ts`, planned as a new file in **03-02 Task 2** (acquire-success / acquire-contended / release)
- [x] Test file / cases for the atomic sentiment budget guard (SC-3) — `lib/api/sentiment.test.ts` extended in **03-03 Task 1** (single consumer passes, second concurrent consumer rejected)
- [x] Test for the pure summary-derivation function (SC-1 cron half) — `lib/cron/summary.test.ts`, planned as a new file in **03-01 Task 2** (keeps it a normal unit test, no route-handler harness needed)

*All Wave 0 test files are planned in the PLAN.md files above. `wave_0_complete` flips to `true` only after execution creates them. Vitest itself is already installed (Phase 1) — no framework install needed. The Redis-boundary mock pattern (`vi.mock("@/lib/cache/redis")`) is established in `lib/cache/timeseries.test.ts` and `lib/api/alerts.test.ts`.*

---

## Manual-Only Verifications

| Behavior | Success Criterion | Why Manual | Test Instructions |
|----------|-------------------|------------|-------------------|
| Concurrent QStash-retry returns early in production | SC-2 | Requires two overlapping real cron invocations against the deployed function; unit test covers the lock helper, but the end-to-end concurrency is observed via logs | After deploy, inspect Vercel logs around a QStash retry window for the `{ status: "locked" }` early-return body; confirm no duplicate tier execution |
| Vercel cron dashboard no longer shows false-green | SC-4 | Vercel's cron dashboard state is external; can only be observed in the Vercel UI | After deploy, confirm the Vercel project's Cron tab no longer lists the removed daily job |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** plans validated — Nyquist-compliant; `wave_0_complete` pending execution
