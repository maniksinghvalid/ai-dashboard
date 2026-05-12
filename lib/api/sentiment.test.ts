import { describe, it, expect } from "vitest";
import {
  preprocessText,
  aggregateSentiment,
  fetchAndCacheSentiment,
} from "@/lib/api/sentiment";

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
});
