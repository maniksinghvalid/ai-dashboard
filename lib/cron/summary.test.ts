import { describe, it, expect } from "vitest";
import { deriveSourceOutcome } from "@/lib/cron/summary";

describe("deriveSourceOutcome", () => {
  it("returns 'fetcher_threw' for a rejected result", () => {
    const result: PromiseSettledResult<unknown[]> = {
      status: "rejected",
      reason: new Error("upstream down"),
    };
    expect(deriveSourceOutcome(result)).toBe("fetcher_threw");
  });

  it("returns 'skipped_empty' for a fulfilled result with an empty array", () => {
    const result: PromiseSettledResult<unknown[]> = {
      status: "fulfilled",
      value: [],
    };
    expect(deriveSourceOutcome(result)).toBe("skipped_empty");
  });

  it("returns 'written' for a fulfilled result with a non-empty array", () => {
    const result: PromiseSettledResult<unknown[]> = {
      status: "fulfilled",
      value: [{ id: "1" }],
    };
    expect(deriveSourceOutcome(result)).toBe("written");
  });

  it("returns 'written' for a fulfilled result whose value is not an array", () => {
    const result: PromiseSettledResult<unknown[]> = {
      status: "fulfilled",
      value: undefined as unknown as unknown[],
    };
    expect(deriveSourceOutcome(result)).toBe("written");
  });
});
