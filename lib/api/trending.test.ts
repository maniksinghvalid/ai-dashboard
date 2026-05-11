import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cache/timeseries", () => ({
  zaddTimepoint: vi.fn().mockResolvedValue(undefined),
  zrangeWindow: vi.fn().mockResolvedValue([]),
  capToSlots: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/cache/helpers", () => ({
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

import {
  countMentionsByTopicPlatform,
  recordCountsToZsets,
  computeVelocityForTopicPlatform,
  pickHeroCandidate,
  getAlertsRows,
} from "@/lib/api/trending";
import { AI_TOPICS } from "@/lib/topics";
import { zaddTimepoint, zrangeWindow, capToSlots } from "@/lib/cache/timeseries";
import type { TrendingTopic } from "@/lib/types";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("countMentionsByTopicPlatform", () => {
  it("counts mentions of Claude across 3 platforms", () => {
    const items = [
      { text: "Claude shipped today", source: "youtube" as const, timestamp: 0 },
      { text: "Claude is wild", source: "reddit" as const, timestamp: 0 },
      { text: "Just tested Claude", source: "twitter" as const, timestamp: 0 },
    ];
    const counts = countMentionsByTopicPlatform(items);
    expect(counts.get("claude:youtube")).toBe(1);
    expect(counts.get("claude:reddit")).toBe(1);
    expect(counts.get("claude:twitter")).toBe(1);
  });

  it("respects word boundary — 'agentsystem' does NOT count toward 'agents'", () => {
    const items = [
      { text: "agentsystem release notes", source: "twitter" as const, timestamp: 0 },
    ];
    const counts = countMentionsByTopicPlatform(items);
    expect(counts.get("agents:twitter")).toBeUndefined();
  });

  it("counts 'AI agents' positively for word-boundary 'agents'", () => {
    const items = [
      { text: "AI agents are everywhere", source: "reddit" as const, timestamp: 0 },
    ];
    const counts = countMentionsByTopicPlatform(items);
    expect(counts.get("agents:reddit")).toBe(1);
  });
});

describe("computeVelocityForTopicPlatform", () => {
  it("returns sumNow - sumPrev (per-hour velocity)", async () => {
    vi.mocked(zrangeWindow)
      .mockResolvedValueOnce([
        { ts: 100, count: 5 },
        { ts: 200, count: 7 },
      ])
      .mockResolvedValueOnce([{ ts: -100, count: 2 }]);
    const v = await computeVelocityForTopicPlatform("claude", "youtube", 9999);
    expect(v).toBe(10); // (5 + 7) - 2
  });
});

describe("recordCountsToZsets", () => {
  it("calls zaddTimepoint and capToSlots(_, 96) per entry", async () => {
    const counts = new Map<string, number>([["claude:youtube", 3]]);
    await recordCountsToZsets(counts, 1700);
    expect(zaddTimepoint).toHaveBeenCalledWith("trending:ts:claude:youtube", 1700, 3);
    expect(capToSlots).toHaveBeenCalledWith("trending:ts:claude:youtube", 96);
  });
});

describe("pickHeroCandidate", () => {
  const makeTopic = (name: string, velocity: number): TrendingTopic => ({
    topic: name,
    mentionCount: 5,
    velocity,
    sources: ["youtube", "reddit", "twitter"],
    score: velocity,
  });

  it("returns the cross-platform topic with the highest aggregate velocity", () => {
    const ranked = {
      youtube: [makeTopic("claude", 5), makeTopic("gemini", 4)],
      reddit: [makeTopic("claude", 3), makeTopic("gpt-5", 2)],
      twitter: [makeTopic("claude", 2), makeTopic("agents", 1)],
    };
    const result = pickHeroCandidate(ranked);
    expect(result).not.toBeNull();
    expect(result?.topic).toBe("claude");
    expect(result?.velocity).toBe(10); // 5 + 3 + 2 aggregate
  });

  it("returns null when no overlap across all 3 platforms' top 3", () => {
    const ranked = {
      youtube: [makeTopic("a", 5)],
      reddit: [makeTopic("b", 3)],
      twitter: [makeTopic("c", 2)],
    };
    expect(pickHeroCandidate(ranked)).toBeNull();
  });
});

describe("getAlertsRows", () => {
  it("returns rows where topicId is a literal AI_TOPICS[k].id (canonical)", async () => {
    // For each (topic, platform) pair, computeVelocityForTopicPlatform makes 2 zrangeWindow
    // calls: windowNow (last hour) and windowPrev (the hour before). Returning a non-empty
    // window-now and an empty window-prev yields a non-zero positive velocity for every pair.
    vi.mocked(zrangeWindow).mockImplementation(async (_key, fromTs, toTs) => {
      const now = Math.floor(Date.now() / 1000);
      // windowNow has fromTs near `now - 3600`; windowPrev has fromTs near `now - 7200`.
      const isWindowNow = toTs >= now - 100;
      return isWindowNow ? [{ ts: fromTs + 1, count: 1 }] : [];
    });

    const rows = await getAlertsRows(Math.floor(Date.now() / 1000));
    expect(rows.length).toBeGreaterThan(0);

    const canonicalIds = new Set(AI_TOPICS.map((t) => t.id));
    for (const row of rows) {
      expect(canonicalIds.has(row.topicId)).toBe(true);
    }

    // Prove at least one row has topicId differing from its display label
    // (ARC-AGI is the obvious case: id "arc-agi" vs label "ARC-AGI").
    const arcRow = rows.find((r) => r.topicId === "arc-agi");
    expect(arcRow).toBeDefined();
    expect(arcRow?.topic).toBe("ARC-AGI");
    expect(arcRow?.topicId).not.toBe(arcRow?.topic);
  });

  it("filters out zero-velocity rows", async () => {
    vi.mocked(zrangeWindow).mockResolvedValue([]); // every window is empty -> velocity 0
    const rows = await getAlertsRows(Math.floor(Date.now() / 1000));
    expect(rows.length).toBe(0);
  });
});
