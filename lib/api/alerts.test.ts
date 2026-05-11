import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cache/redis", () => ({
  getRedis: vi.fn(),
}));

vi.mock("@/lib/cache/timeseries", () => ({
  zrangeWindow: vi.fn(),
}));

import {
  detectSpike,
  writeSpikeAlert,
  computeBaseline24h,
  writeSpikeAlertsFromTrending,
} from "@/lib/api/alerts";
import { getRedis } from "@/lib/cache/redis";
import { zrangeWindow } from "@/lib/cache/timeseries";

const mockRedis = {
  lpush: vi.fn().mockResolvedValue(1),
  ltrim: vi.fn().mockResolvedValue("OK"),
};

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getRedis).mockReturnValue(mockRedis as any);
});

describe("detectSpike", () => {
  it("returns true when velocity > 5 * baseline", () => {
    expect(detectSpike(600, 100)).toBe(true);
  });

  it("returns false when velocity is exactly 5 * baseline (strict >)", () => {
    expect(detectSpike(500, 100)).toBe(false);
  });

  it("returns false when baseline is 0 (degenerate)", () => {
    expect(detectSpike(100, 0)).toBe(false);
  });
});

describe("writeSpikeAlert", () => {
  it("LPUSHes then LTRIMs to keep newest 100 items", async () => {
    await writeSpikeAlert("agents", 600, 100);
    expect(mockRedis.lpush).toHaveBeenCalledTimes(1);
    expect(mockRedis.lpush).toHaveBeenCalledWith("alerts:spikes", expect.any(String));
    expect(mockRedis.ltrim).toHaveBeenCalledTimes(1);
    expect(mockRedis.ltrim).toHaveBeenCalledWith("alerts:spikes", 0, 99);

    // Verify call order
    const lpushOrder = vi.mocked(mockRedis.lpush).mock.invocationCallOrder[0];
    const ltrimOrder = vi.mocked(mockRedis.ltrim).mock.invocationCallOrder[0];
    expect(lpushOrder).toBeLessThan(ltrimOrder);

    // Verify payload structure
    const payloadStr = vi.mocked(mockRedis.lpush).mock.calls[0][1] as string;
    const payload = JSON.parse(payloadStr);
    expect(payload).toHaveProperty("topic", "agents");
    expect(payload).toHaveProperty("velocity", 600);
    expect(payload).toHaveProperty("baseline", 100);
    expect(payload).toHaveProperty("multiplier", 6);
    expect(payload).toHaveProperty("detectedAt");
  });
});

describe("computeBaseline24h", () => {
  it("returns the per-hour mean over the 24h window", async () => {
    vi.mocked(zrangeWindow).mockResolvedValueOnce([
      { ts: 100, count: 24 },
      { ts: 200, count: 24 },
    ]);
    const baseline = await computeBaseline24h("claude", "youtube");
    expect(baseline).toBe(2); // sum 48 / 24 hours = 2
  });
});

describe("writeSpikeAlertsFromTrending", () => {
  it("writes an alert for rows whose velocity > 5× baseline", async () => {
    // Baseline = 100 (sum 2400 / 24); velocity 600 → spike.
    vi.mocked(zrangeWindow).mockResolvedValueOnce([{ ts: 0, count: 2400 }]);

    await writeSpikeAlertsFromTrending([
      { topicId: "claude", topic: "Claude", platform: "youtube", velocity: 600 },
    ]);
    expect(mockRedis.lpush).toHaveBeenCalledTimes(1);
  });

  it("skips rows whose velocity does NOT exceed 5× baseline", async () => {
    // Baseline = 200 (sum 4800 / 24); velocity 600 → 3× baseline → no spike.
    vi.mocked(zrangeWindow).mockResolvedValueOnce([{ ts: 0, count: 4800 }]);

    await writeSpikeAlertsFromTrending([
      { topicId: "claude", topic: "Claude", platform: "youtube", velocity: 600 },
    ]);
    expect(mockRedis.lpush).not.toHaveBeenCalled();
  });
});
