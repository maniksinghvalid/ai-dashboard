import * as Sentry from "@sentry/nextjs";
import { getRedis } from "@/lib/cache/redis";
import { zrangeWindow } from "@/lib/cache/timeseries";
import { CACHE_KEYS } from "@/lib/constants";
import type { SpikeAlert } from "@/lib/types";

const SPIKE_MULTIPLIER = 5;
const ALERT_LIST_CAP_INDEX = 99; // keep newest 100 items (indices 0..99)
const TWENTY_FOUR_HOURS_SECONDS = 86400;

type AlertPlatform = "youtube" | "reddit" | "twitter";

export function detectSpike(velocity: number, baseline: number): boolean {
  return baseline > 0 && velocity > SPIKE_MULTIPLIER * baseline;
}

export async function writeSpikeAlert(
  topic: string,
  velocity: number,
  baseline: number,
): Promise<void> {
  const payload: SpikeAlert = {
    topic,
    velocity,
    baseline,
    multiplier: velocity / baseline,
    detectedAt: new Date().toISOString(),
  };
  try {
    const redis = getRedis();
    await redis.lpush(CACHE_KEYS.spikes, JSON.stringify(payload));
    await redis.ltrim(CACHE_KEYS.spikes, 0, ALERT_LIST_CAP_INDEX);
  } catch (err) {
    console.error("[alerts] writeSpikeAlert failed:", err);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(err);
    }
  }
}

export async function computeBaseline24h(
  topicId: string,
  platform: AlertPlatform,
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const key = `trending:ts:${topicId}:${platform}`;
  const points = await zrangeWindow(key, now - TWENTY_FOUR_HOURS_SECONDS, now);
  const sum = points.reduce((s, p) => s + p.count, 0);
  return sum / 24; // per-hour mean over the 24h window
}

export async function writeSpikeAlertsFromTrending(
  rows: Array<{
    topicId: string;
    topic: string;
    platform: AlertPlatform;
    velocity: number;
  }>,
): Promise<void> {
  const settled = await Promise.allSettled(
    rows.map(async (row) => {
      const baseline = await computeBaseline24h(row.topicId, row.platform);
      if (detectSpike(row.velocity, baseline)) {
        await writeSpikeAlert(row.topic, row.velocity, baseline);
      }
    }),
  );

  for (const r of settled) {
    if (r.status === "rejected") {
      console.error("[alerts] per-row spike detection failed:", r.reason);
      if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
        Sentry.captureException(r.reason);
      }
    }
  }
}
