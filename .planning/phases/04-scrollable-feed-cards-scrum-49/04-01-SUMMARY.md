---
phase: 04-scrollable-feed-cards-scrum-49
plan: 01
subsystem: testing-infrastructure
tags: [vitest, jsdom, testing-library, devDeps, wave-0]
dependency_graph:
  requires: []
  provides:
    - "jsdom-capable Vitest setup for downstream component tests (.test.tsx discovery + per-file `// @vitest-environment jsdom` pragma path)"
  affects:
    - "All Wave 1+ plans that ship `.test.tsx` files (04-02 through 04-08)"
tech_stack:
  added:
    - "@testing-library/react@^16.3.2 (devDependency)"
    - "@testing-library/dom@^10.4.1 (devDependency — RTL v16 peer)"
    - "jsdom@^29.1.1 (devDependency)"
  patterns:
    - "Per-file `// @vitest-environment jsdom` pragma (CONTEXT.md D10 with RESEARCH.md correction); `vitest.config.ts` keeps `environment: \"node\"` globally"
    - "include glob `**/*.test.{ts,tsx}` so `.tsx` test files are picked up"
key_files:
  created: []
  modified:
    - "package.json"
    - "package-lock.json"
    - "vitest.config.ts"
decisions:
  - "Per-file pragma over `test.projects` split — minimal config blast radius (RESEARCH §Standard Stack)"
  - "`jsdom` over `happy-dom` — safer API parity; 4-6 test files won't notice the perf delta (RESEARCH §Alternatives Considered)"
  - "Skipped `@testing-library/user-event` — D10 only requires `fireEvent.scroll()` (RESEARCH Open Question 4 NO disposition)"
metrics:
  duration_minutes: "~3"
  completed_date: "2026-05-14"
---

# Phase 4 Plan 01: Wave 0 setup — Vitest + jsdom devDependencies Summary

One-liner: Installed `@testing-library/react@^16.3.2`, `@testing-library/dom@^10.4.1`, and `jsdom@^29.1.1` as devDependencies and extended Vitest's `include` glob from `**/*.test.ts` to `**/*.test.{ts,tsx}` so Wave 1+ component tests can land without a Vitest config bump.

## What Changed

### Task 1 — Install jsdom-based component-test devDependencies (commit `3db0476`)
- Ran `npm install --save-dev @testing-library/react@^16 @testing-library/dom@^10 jsdom@^29` from the repo root in one invocation so npm resolved RTL v16's peer dependency on `@testing-library/dom` deterministically (RESEARCH Pitfall 2 mitigation).
- Resolved versions (from `package-lock.json`):
  - `@testing-library/react`: `16.3.2`
  - `@testing-library/dom`: `10.4.1`
  - `jsdom`: `29.1.1`
- Did NOT install `@testing-library/user-event` (Open Question 4 → NO; `fireEvent.scroll` from RTL is enough for D5's fade-visibility test).
- Did NOT install `happy-dom` (RESEARCH §Alternatives Considered — `jsdom` chosen for API safety).

### Task 2 — Extend Vitest include glob (commit `ab9c6f1`)
- `vitest.config.ts` diff:
  ```diff
  -    include: ["**/*.test.ts"],
  +    include: ["**/*.test.{ts,tsx}"],
  ```
- `environment: "node"` left unchanged. Wave 1+ component tests opt into jsdom via the per-file `// @vitest-environment jsdom` pragma (CONTEXT.md D10 + RESEARCH Pitfall 1: `environmentMatchGlobs` was removed in Vitest 4).
- `exclude`, `passWithNoTests`, and the `@` alias untouched.

## Verification Results

| Check | Result |
|-------|--------|
| `node -e "require('@testing-library/react')"` | exits 0 |
| `node -e "require('@testing-library/dom')"` | exits 0 |
| `node -e "require('jsdom')"` | exits 0 |
| `grep -c '"**/*.test.{ts,tsx}"' vitest.config.ts` | 1 |
| `grep -c 'environmentMatchGlobs' vitest.config.ts` | 0 |
| `grep -c 'environment: "node"' vitest.config.ts` | 1 |
| `npm test` (existing suite) | 12 files, 102 tests, 0 failures, 815ms |
| `npm audit --omit=dev` advisories attributable to new pkgs | NONE (3 pre-existing advisories: Next.js GHSA-36qx-fr4f-26g5 + postcss <8.5.10 + transitive; unchanged from baseline) |

`npm audit` (full) reported 6 vulnerabilities total (1 moderate, 5 high). A JSON scan over the advisory graph confirmed **zero advisories are attributable to `@testing-library/react`, `@testing-library/dom`, or `jsdom`** — all surfaced advisories chain back to pre-existing deps (`next`, `eslint-config-prettier`, `postcss`, etc.). T-04-supply-chain mitigation satisfied: pinned majors verified against npm registry on 2026-05-14, `package-lock.json` locks resolved versions, no high/critical advisories chargeable to the new packages.

## Deviations from Plan

None — plan executed exactly as written. (One context-restoration step was performed before reading the plan: `git merge develop` into the worktree branch to bring the Phase 4 planning files into scope, since the worktree was spawned at commit `38b0da0` which predates the Phase 4 plans on `develop`. This was a setup operation, not a code deviation.)

## Known Stubs

None. This plan is pure dev-tooling setup; no app code surface introduced.

## Threat Flags

None. No new network endpoints, auth paths, file-access patterns, or schema changes. The single threat from the plan (`T-04-supply-chain` — npm registry → local devDependencies tampering) was already in the plan's threat register and is mitigated as documented above.

## Self-Check: PASSED

- `package.json` modified — present (3 new devDeps verified via `node -e "require('./package.json').devDependencies"`)
- `package-lock.json` modified — present (resolved versions verified)
- `vitest.config.ts` modified — present (glob extended; verified via `grep`)
- Commit `3db0476` — present in `git log` (Task 1)
- Commit `ab9c6f1` — present in `git log` (Task 2)
- 102 tests still pass — verified via two independent `npm test` runs (post-install and post-config-change)

## Commits

| Hash       | Type  | Subject                                                                           |
|------------|-------|-----------------------------------------------------------------------------------|
| `3db0476`  | chore | `chore(04-01): install jsdom/@testing-library devDependencies for component tests` |
| `ab9c6f1`  | chore | `chore(04-01): extend Vitest include glob to discover .tsx test files`             |
