import { getRedis } from "@/lib/cache/redis";
import type { CachedData } from "@/lib/types";

const SAFETY_TTL_SECONDS = 86400; // 24 hours

export async function cacheGet<T>(
  key: string,
  maxAgeMs: number
): Promise<{ data: T; fetchedAt: string; stale: boolean } | null> {
  const redis = getRedis();
  const raw = await redis.get<CachedData<T>>(key);

  if (!raw || !raw.data) {
    return null;
  }

  const ageMs = Date.now() - new Date(raw.fetchedAt).getTime();
  const stale = ageMs > maxAgeMs;

  return { data: raw.data, fetchedAt: raw.fetchedAt, stale };
}

export async function cacheSet<T>(
  key: string,
  data: T,
  options?: { allowEmpty?: boolean },
): Promise<boolean> {
  // Don't overwrite good cached data with empty results unless explicitly allowed
  if (Array.isArray(data) && data.length === 0 && !options?.allowEmpty) {
    console.warn(
      `[cache] skipping empty write to "${key}" (pass allowEmpty to override)`,
    );
    return false;
  }

  const redis = getRedis();
  const wrapped: CachedData<T> = {
    data,
    fetchedAt: new Date().toISOString(),
  };
  await redis.set(key, wrapped, { ex: SAFETY_TTL_SECONDS });
  return true;
}
