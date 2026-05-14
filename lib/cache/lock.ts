import { randomUUID } from "node:crypto";
import { getRedis } from "@/lib/cache/redis";
import { CACHE_KEYS } from "@/lib/constants";

// 90 is strictly greater than the cron route's `maxDuration` (60). If a refresh
// function is hard-killed before its `finally` runs releaseLock, the lock still
// EX-expires on its own — the system self-heals rather than deadlocking.
const LOCK_TTL_SECONDS = 90;

/**
 * Attempt to acquire the distributed cron lock.
 * Returns a unique lock value (to pass to releaseLock) on success, or `null`
 * when the lock is already held (NX contention).
 */
export async function acquireLock(): Promise<string | null> {
  const redis = getRedis();
  const lockValue = `${Date.now()}-${randomUUID()}`;
  // redis.set with { nx: true } resolves "OK" on acquire, null on contention.
  // Branch on === "OK" explicitly — the return is "OK" | null, never a boolean.
  const result = await redis.set(CACHE_KEYS.cronLock, lockValue, {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  return result === "OK" ? lockValue : null;
}

/**
 * Release the cron lock, but only if it still holds our value.
 *
 * Release-strategy trade-off: a value-checked delete (vs an unconditional `del`)
 * is used so a slow Run A whose lock already EX-expired and was re-acquired by
 * Run B does not delete Run B's lock. The `eval` makes the get-and-delete atomic
 * server-side, closing the get/del race window that a client-side check-then-del
 * would leave open.
 */
export async function releaseLock(lockValue: string): Promise<void> {
  const redis = getRedis();
  const script =
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';
  await redis.eval(script, [CACHE_KEYS.cronLock], [lockValue]);
}
