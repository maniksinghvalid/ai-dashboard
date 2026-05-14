import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cache/redis", () => ({
  getRedis: vi.fn(),
}));

// sentiment.ts no longer imports Sentry — this mock is the regression guard:
// if a future edit re-adds a Sentry.captureException to the 401 branch, the
// "no self-capture" assertion below will fail.
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import {
  preprocessText,
  aggregateSentiment,
  fetchAndCacheSentiment,
  checkAndConsumeBudget,
} from "@/lib/api/sentiment";
import { getRedis } from "@/lib/cache/redis";

const mockRedis = {
  eval: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getRedis).mockReturnValue(mockRedis as any);
});

describe("preprocessText (noise reduction for the LLM judge)", () => {
  it("replaces @handle with literal @user and URL with literal http", () => {
    expect(preprocessText("Hello @karpathy check https://x.com/foo")).toBe(
      "Hello @user check http",
    );
  });

  it("leaves plain text unchanged", () => {
    expect(preprocessText("plain text no replacements")).toBe(
      "plain text no replacements",
    );
  });

  it("replaces multiple handles", () => {
    expect(preprocessText("@a hi @b")).toBe("@user hi @user");
  });

  it("replaces http:// URLs (no s)", () => {
    expect(preprocessText("see http://x.com")).toBe("see http");
  });
});

describe("aggregateSentiment", () => {
  it("three percentages sum to 100 for balanced input", () => {
    const r = aggregateSentiment([
      { label: "positive", score: 1 },
      { label: "neutral", score: 1 },
      { label: "negative", score: 1 },
    ]);
    expect(r.positive + r.neutral + r.negative).toBe(100);
    expect(r.sampleSize).toBe(3);
  });

  it("empty input returns a sum-to-100 default with sampleSize 0", () => {
    const r = aggregateSentiment([]);
    expect(r.positive + r.neutral + r.negative).toBe(100);
    expect(r.sampleSize).toBe(0);
  });

  it("all-positive returns 100/0/0 with the right sampleSize", () => {
    const r = aggregateSentiment(
      Array.from({ length: 10 }, () => ({ label: "positive" as const, score: 0.9 })),
    );
    expect(r).toEqual({ positive: 100, neutral: 0, negative: 0, sampleSize: 10 });
  });

  it("rounding sums to 100 even for inputs that don't divide evenly", () => {
    const r = aggregateSentiment([
      { label: "positive", score: 1 },
      { label: "neutral", score: 1 },
      { label: "negative", score: 1 },
      { label: "positive", score: 1 },
      { label: "neutral", score: 1 },
      { label: "negative", score: 1 },
      { label: "positive", score: 1 },
    ]);
    expect(r.positive + r.neutral + r.negative).toBe(100);
    expect(r.sampleSize).toBe(7);
  });
});

describe("fetchAndCacheSentiment failure signalling", () => {
  // Guards the contract that no-cache paths throw, so Promise.allSettled in the
  // cron can distinguish "cached new data" (fulfilled) from "bailed without
  // writing" (rejected) and the cron summary stays honest. Regression-tests
  // the specific bug that caused /api/sentiment to 503 silently.
  it("throws when TOGETHER_API_KEY is missing", async () => {
    const prev = process.env.TOGETHER_API_KEY;
    delete process.env.TOGETHER_API_KEY;
    try {
      await expect(
        fetchAndCacheSentiment([{ text: "hello" }]),
      ).rejects.toThrow(/TOGETHER_API_KEY/);
    } finally {
      if (prev !== undefined) process.env.TOGETHER_API_KEY = prev;
    }
  });

  it("throws the distinctive 401 error when Together AI returns 401", async () => {
    // SCRUM-47: a rotated/expired key → Together AI 401. The 401 branch must
    // throw the distinctive message (so it's its own Sentry issue via the
    // cron's single capture point) and must NOT self-capture to Sentry.
    const prev = process.env.TOGETHER_API_KEY;
    const originalFetch = global.fetch;
    process.env.TOGETHER_API_KEY = "test-key";
    mockRedis.eval.mockResolvedValueOnce(1); // budget guard passes → reaches fetch
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      statusText: "Unauthorized",
    } as Response);
    try {
      await expect(
        fetchAndCacheSentiment([{ text: "some post title" }]),
      ).rejects.toThrow(/Together AI 401.*TOGETHER_API_KEY/);
      // SCRUM-47 regression guard: the 401 branch must NOT self-capture to
      // Sentry — the cron's captureIfSentry is the single capture point.
      expect(Sentry.captureException).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      if (prev !== undefined) process.env.TOGETHER_API_KEY = prev;
      else delete process.env.TOGETHER_API_KEY;
    }
  });
});

describe("checkAndConsumeBudget — atomic daily char budget guard", () => {
  // The check-and-consume must be a single atomic Redis operation: two
  // concurrent runs must not both pass the guard and together overspend the
  // daily char budget. We assert the true/false contract — the guard resolves
  // true exactly when the atomic op reports "consumed", false when "rejected".
  it("resolves true for a single consumer that is under budget", async () => {
    mockRedis.eval.mockResolvedValueOnce(1);
    await expect(checkAndConsumeBudget(1000)).resolves.toBe(true);
  });

  it("resolves false when the atomic op rejects (would exceed budget)", async () => {
    mockRedis.eval.mockResolvedValueOnce(0);
    await expect(checkAndConsumeBudget(1000)).resolves.toBe(false);
  });

  it("rejects the second of two concurrent consumers near the limit", async () => {
    // First consumer consumes the remaining budget atomically (1), the second
    // — racing on the same key — is rejected (0). Only the first passes.
    mockRedis.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const [first, second] = await Promise.all([
      checkAndConsumeBudget(1000),
      checkAndConsumeBudget(1000),
    ]);

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("fails closed when eval resolves anything other than the integer 1", async () => {
    // The guard branches on `result === 1` — a strict, fail-closed coercion.
    // A null (Lua boolean leak) or a string "1" (transport quirk) must NOT be
    // read as "consumed". This locks that contract against future refactors.
    mockRedis.eval.mockResolvedValueOnce(null);
    await expect(checkAndConsumeBudget(1000)).resolves.toBe(false);

    mockRedis.eval.mockResolvedValueOnce("1");
    await expect(checkAndConsumeBudget(1000)).resolves.toBe(false);
  });
});
