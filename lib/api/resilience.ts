// Shared transient-failure retry policy for the source fetchers (reddit.ts,
// twitter.ts). Keeping these here means a change to the retry contract applies
// to every fetcher at once, instead of drifting between per-file copies.

// HTTP statuses worth one retry: 429 (rate limited) and 503 (transient
// unavailable). Anything else (401, 403, 404, 5xx-other) is treated as
// terminal — retrying won't help.
export const RETRY_STATUS = new Set([429, 503]);

// Backoff before the single retry: 2000–4999ms of jitter. The randomness
// spreads retries from a batch of concurrent callers so they don't all hit
// the upstream again in lockstep.
export function jitterMs(): number {
  return 2000 + Math.floor(Math.random() * 3000);
}
