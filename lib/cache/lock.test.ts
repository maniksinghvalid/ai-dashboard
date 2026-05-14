import { describe, it, expect, vi, beforeEach } from "vitest";
import { acquireLock, releaseLock } from "@/lib/cache/lock";
import { getRedis } from "@/lib/cache/redis";
import { CACHE_KEYS } from "@/lib/constants";

vi.mock("@/lib/cache/redis", () => ({
  getRedis: vi.fn(),
}));

const mockRedis = {
  set: vi.fn(),
  eval: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getRedis).mockReturnValue(mockRedis as any);
});

describe("acquireLock", () => {
  it("returns a truthy unique lock value when redis.set resolves 'OK'", async () => {
    mockRedis.set.mockResolvedValueOnce("OK");
    const value = await acquireLock();
    expect(value).toBeTruthy();
    expect(typeof value).toBe("string");

    expect(mockRedis.set).toHaveBeenCalledTimes(1);
    const [key, setValue, options] = mockRedis.set.mock.calls[0];
    expect(key).toBe(CACHE_KEYS.cronLock);
    expect(setValue).toBe(value);
    expect(options).toMatchObject({ nx: true, ex: 90 });
  });

  it("returns null when redis.set resolves null (NX contention)", async () => {
    mockRedis.set.mockResolvedValueOnce(null);
    const value = await acquireLock();
    expect(value).toBeNull();
  });
});

describe("releaseLock", () => {
  it("calls redis.eval with the value-checked-delete script, key, and value", async () => {
    await releaseLock("v");
    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    const [script, keys, args] = mockRedis.eval.mock.calls[0];
    expect(script).toContain("del");
    expect(script).toContain("get");
    expect(keys).toEqual([CACHE_KEYS.cronLock]);
    expect(args).toEqual(["v"]);
  });
});
