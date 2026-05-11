import { getRedis } from "@/lib/cache/redis";

const SAFETY_TTL_SECONDS = 86400; // 24h key-level TTL bound on top of slot cap

export async function zaddTimepoint(
  key: string,
  ts: number,
  count: number,
): Promise<void> {
  const redis = getRedis();
  await redis.zadd(key, { score: ts, member: `${ts}:${count}` });
  await redis.expire(key, SAFETY_TTL_SECONDS);
}

export async function zrangeWindow(
  key: string,
  fromTs: number,
  toTs: number,
): Promise<Array<{ ts: number; count: number }>> {
  const redis = getRedis();
  const raw = (await redis.zrange(key, fromTs, toTs, { byScore: true })) as
    | string[]
    | null
    | undefined;

  if (!raw || raw.length === 0) return [];

  const decoded: Array<{ ts: number; count: number }> = [];
  for (const member of raw) {
    const [tsStr, countStr] = String(member).split(":");
    const ts = Number(tsStr);
    const count = Number(countStr);
    if (Number.isNaN(ts) || Number.isNaN(count)) continue;
    decoded.push({ ts, count });
  }
  return decoded;
}

export async function capToSlots(
  key: string,
  maxEntries: number,
): Promise<void> {
  const redis = getRedis();
  // Removes the OLDEST entries first; keeps the last `maxEntries` highest-score members.
  await redis.zremrangebyrank(key, 0, -(maxEntries + 1));
}
