# Plan 03-04 Summary: Remove dead Vercel cron

## What changed

### `vercel.json`
- Removed the `crons` entry (`{ "path": "/api/cron/refresh", "schedule": "0 0 * * *" }`) entirely.
- File is now the single valid JSON object `{}`.

### `CLAUDE.md` (`## Deployment` section only)
- Rewrote the opening Deployment sentence: refresh is now driven solely by Upstash QStash's 15-minute POST schedule; notes the Vercel daily `crons` entry has been removed and `vercel.json` is now an empty object.
- Updated the "Vercel built-in scheduled cron" row in the bypass-interactions table to state it has been removed (no longer implies a live daily cron).
- Expanded the "Practical implication" paragraph with the explicit *why*: under Deployment Protection the Vercel edge 401s the cron invocation before it reaches the route handler, and Vercel's cron dashboard reports that 401 as a successful run — a false-green that is actively misleading during incident response.
- Left the rest of the Deployment Protection section (QStash query-param transport, bypass table for QStash/curl, rotation guidance, diagnostic note) intact.

## Verification
- `grep -c '"crons"' vercel.json` → `0`
- `vercel.json` parses as valid JSON → VALID
- `grep -A3 '"crons"' vercel.json` → nothing
- `grep -ci 'false.green' CLAUDE.md` → `1`
- `grep -ci 'QStash' CLAUDE.md` → `7`
- `npm test` → 70 passed; `npm run lint` → no errors

## Deviations
None. Pure config + docs as specified. No runtime code touched.

## Scope notes
- `CLAUDE.md` line 22 (`## Architecture`) still mentions "(Vercel daily cron)" describing the route's GET handler — left untouched, it is outside the `## Deployment` section and does not claim a `vercel.json` cron is configured.
