// Diagnostic: inspect actual TTL + fetchedAt age for every cache key in prod Redis.
// Read-only — no writes. Run: npx tsx --env-file=.env.local scripts/diag-redis-ttl.ts
import { Redis } from "@upstash/redis";

const KEYS = [
  "yt:latest",
  "reddit:hot",
  "x:feed",
  "news:feed",
  "trending:topics",
  "trending:ranked",
  "hero:cross-platform",
  "sentiment:latest",
  "alerts:spikes",
];

function fmtTtl(ttl: number): string {
  if (ttl === -2) return "-2 (KEY DOES NOT EXIST)";
  if (ttl === -1) return "-1 (NO EXPIRY SET — persistent!)";
  const h = (ttl / 3600).toFixed(2);
  return `${ttl}s (~${h}h remaining)`;
}

function fmtAge(fetchedAt: unknown): string {
  if (typeof fetchedAt !== "string") return `n/a (fetchedAt=${JSON.stringify(fetchedAt)})`;
  const ms = Date.now() - new Date(fetchedAt).getTime();
  if (Number.isNaN(ms)) return `unparseable (${fetchedAt})`;
  const h = (ms / 3_600_000).toFixed(2);
  return `${fetchedAt} (${h}h old)`;
}

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.error("UPSTASH_REDIS_REST_URL / _TOKEN not set");
    process.exit(1);
  }
  const redis = new Redis({ url, token });

  console.log(`Redis TTL diagnostic @ ${new Date().toISOString()}\n`);
  for (const key of KEYS) {
    const ttl = await redis.ttl(key);
    const raw = await redis.get<{ data?: unknown; fetchedAt?: unknown }>(key);
    let dataInfo = "no value";
    if (raw && typeof raw === "object") {
      const d = (raw as { data?: unknown }).data;
      const len = Array.isArray(d) ? `array[${d.length}]` : typeof d;
      dataInfo = `data=${len} | fetchedAt=${fmtAge((raw as { fetchedAt?: unknown }).fetchedAt)}`;
    }
    console.log(`${key.padEnd(22)} TTL=${fmtTtl(ttl)}`);
    console.log(`${" ".repeat(22)} ${dataInfo}\n`);
  }
}

main();
