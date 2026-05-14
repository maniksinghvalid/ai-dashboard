// Three-state outcome for a Tier 1 cron source.
//
// Why re-derivation lives here (in the cron) rather than inside each fetcher:
// the YouTube fetcher has pre-cacheSet early returns — the no-API-key `return []`
// and the `videoIds.length === 0` `return []` — both return `[]` BEFORE `cacheSet`
// is ever called. So a `cacheSet` write boolean alone cannot cover YouTube. The
// cron instead infers `skipped_empty` uniformly across all four Tier 1 sources
// from `(fulfilled) && (empty array)`, which is true whether the empty result
// came from a skipped cacheSet write or from an early `return []`.
export type SourceOutcome = "written" | "skipped_empty" | "fetcher_threw";

export function deriveSourceOutcome(
  result: PromiseSettledResult<unknown[]>,
): SourceOutcome {
  if (result.status === "rejected") {
    return "fetcher_threw";
  }
  if (Array.isArray(result.value) && result.value.length === 0) {
    return "skipped_empty";
  }
  return "written";
}
