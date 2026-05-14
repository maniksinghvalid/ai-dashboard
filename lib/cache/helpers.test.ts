import { describe, it, expect, vi, beforeEach } from "vitest";
import { cacheSet } from "@/lib/cache/helpers";
import { getRedis } from "@/lib/cache/redis";

vi.mock("@/lib/cache/redis", () => ({
  getRedis: vi.fn(),
}));

const mockRedis = {
  set: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getRedis).mockReturnValue(mockRedis as any);
});

describe("cacheSet", () => {
  it("returns true and writes when data is a non-empty array", async () => {
    const result = await cacheSet("k", [{ x: 1 }]);
    expect(result).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledTimes(1);
  });

  it("returns false and skips the write when data is an empty array", async () => {
    const result = await cacheSet("k", []);
    expect(result).toBe(false);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it("returns true and writes when an empty array is passed with allowEmpty", async () => {
    const result = await cacheSet("k", [], { allowEmpty: true });
    expect(result).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledTimes(1);
  });

  it("returns true and writes for non-array data (never guarded)", async () => {
    const result = await cacheSet("k", { hero: "story" });
    expect(result).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledTimes(1);
  });
});
