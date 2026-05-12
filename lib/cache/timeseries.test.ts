import { describe, it, expect, vi, beforeEach } from "vitest";
import { zaddTimepoint, zrangeWindow, capToSlots } from "@/lib/cache/timeseries";
import { getRedis } from "@/lib/cache/redis";

vi.mock("@/lib/cache/redis", () => ({
  getRedis: vi.fn(),
}));

const mockRedis = {
  zadd: vi.fn(),
  zrange: vi.fn(),
  zremrangebyrank: vi.fn(),
  expire: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getRedis).mockReturnValue(mockRedis as any);
});

describe("zaddTimepoint", () => {
  it("calls redis.zadd with encoded member", async () => {
    await zaddTimepoint("test:topic:youtube", 1700000000, 5);
    expect(mockRedis.zadd).toHaveBeenCalledTimes(1);
    expect(mockRedis.zadd).toHaveBeenCalledWith("test:topic:youtube", {
      score: 1700000000,
      member: "1700000000:5",
    });
    expect(mockRedis.expire).toHaveBeenCalledWith("test:topic:youtube", 86400);
  });
});

describe("zrangeWindow", () => {
  it("decodes members and returns ts/count rows", async () => {
    mockRedis.zrange.mockResolvedValueOnce(["1500:7", "1600:3"]);
    const result = await zrangeWindow("k", 1000, 2000);
    expect(mockRedis.zrange).toHaveBeenCalledWith("k", 1000, 2000, { byScore: true });
    expect(result).toEqual([
      { ts: 1500, count: 7 },
      { ts: 1600, count: 3 },
    ]);
  });

  it("returns [] for empty result", async () => {
    mockRedis.zrange.mockResolvedValueOnce([]);
    const result = await zrangeWindow("k", 1000, 2000);
    expect(result).toEqual([]);
  });

  it("skips malformed members", async () => {
    mockRedis.zrange.mockResolvedValueOnce(["1500:7", "garbage", "1600:3"]);
    const result = await zrangeWindow("k", 1000, 2000);
    expect(result).toEqual([
      { ts: 1500, count: 7 },
      { ts: 1600, count: 3 },
    ]);
  });
});

describe("capToSlots", () => {
  it("calls zremrangebyrank with the correct cap bounds", async () => {
    await capToSlots("k", 96);
    expect(mockRedis.zremrangebyrank).toHaveBeenCalledTimes(1);
    expect(mockRedis.zremrangebyrank).toHaveBeenCalledWith("k", 0, -97);
  });
});

describe("redis client usage", () => {
  it("all three functions go through getRedis()", async () => {
    mockRedis.zrange.mockResolvedValueOnce([]);
    await zaddTimepoint("k", 1, 1);
    await zrangeWindow("k", 0, 10);
    await capToSlots("k", 96);
    expect(vi.mocked(getRedis)).toHaveBeenCalled();
  });
});
