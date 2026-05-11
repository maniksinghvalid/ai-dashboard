import type { Video, RedditPost, Tweet, TrendingTopic } from "@/lib/types";
import { CACHE_KEYS } from "@/lib/constants";
import { cacheSet } from "@/lib/cache/helpers";
import { AI_TOPICS, matchTopic, type Topic } from "@/lib/topics";
import {
  zaddTimepoint,
  zrangeWindow,
  capToSlots,
} from "@/lib/cache/timeseries";

type Platform = "youtube" | "reddit" | "twitter";
const PLATFORMS: Platform[] = ["youtube", "reddit", "twitter"];
const ZSET_SLOT_CAP = 96;
const HOUR_SECONDS = 3600;

interface TextItem {
  text: string;
  source: Platform;
  timestamp: number;
}

function zsetKey(topicId: string, platform: Platform): string {
  return `trending:ts:${topicId}:${platform}`;
}

function extractTextItems(
  videos: Video[],
  posts: RedditPost[],
  tweets: Tweet[],
): TextItem[] {
  const items: TextItem[] = [];

  for (const v of videos) {
    items.push({
      text: v.title,
      source: "youtube",
      timestamp: new Date(v.publishedAt).getTime(),
    });
  }

  for (const p of posts) {
    items.push({
      text: p.title,
      source: "reddit",
      timestamp: new Date(p.createdAt).getTime(),
    });
  }

  for (const t of tweets) {
    items.push({
      text: t.text,
      source: "twitter",
      timestamp: new Date(t.createdAt).getTime(),
    });
  }

  return items;
}

export function countMentionsByTopicPlatform(items: TextItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  if (items.length === 0) return counts;

  for (const topic of AI_TOPICS) {
    for (const item of items) {
      if (!matchTopic(item.text, topic)) continue;
      const key = `${topic.id}:${item.source}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export async function recordCountsToZsets(
  counts: Map<string, number>,
  now: number,
): Promise<void> {
  const writes: Array<Promise<void>> = [];
  Array.from(counts.entries()).forEach(([composite, count]) => {
    const [topicId, platform] = composite.split(":") as [string, Platform];
    const key = zsetKey(topicId, platform);
    writes.push(
      (async () => {
        await zaddTimepoint(key, now, count);
        await capToSlots(key, ZSET_SLOT_CAP);
      })(),
    );
  });
  await Promise.all(writes);
}

export async function computeVelocityForTopicPlatform(
  topicId: string,
  platform: string,
  now: number,
): Promise<number> {
  const key = zsetKey(topicId, platform as Platform);
  const [windowNow, windowPrev] = await Promise.all([
    zrangeWindow(key, now - HOUR_SECONDS, now),
    zrangeWindow(key, now - 2 * HOUR_SECONDS, now - HOUR_SECONDS),
  ]);
  const sumNow = windowNow.reduce((s, p) => s + p.count, 0);
  const sumPrev = windowPrev.reduce((s, p) => s + p.count, 0);
  return sumNow - sumPrev; // per-hour velocity (window is 3600s = 1h)
}

function findTopic(topicId: string): Topic | undefined {
  return AI_TOPICS.find((t) => t.id === topicId);
}

export function calculateTrending(
  videos: Video[],
  posts: RedditPost[],
  tweets: Tweet[],
): TrendingTopic[] {
  const items = extractTextItems(videos, posts, tweets);
  if (items.length === 0) return [];

  const counts = countMentionsByTopicPlatform(items);

  // Aggregate counts per topic across platforms (synchronous path — cold-start velocity may be 0).
  const perTopic = new Map<string, { mentionCount: number; sources: Set<Platform> }>();
  Array.from(counts.entries()).forEach(([composite, count]) => {
    const [topicId, platform] = composite.split(":") as [string, Platform];
    const agg = perTopic.get(topicId) ?? { mentionCount: 0, sources: new Set<Platform>() };
    agg.mentionCount += count;
    agg.sources.add(platform);
    perTopic.set(topicId, agg);
  });

  const results: TrendingTopic[] = [];
  Array.from(perTopic.entries()).forEach(([topicId, agg]) => {
    const topic = findTopic(topicId);
    if (!topic) return;
    if (agg.mentionCount < 1) return;

    results.push({
      topic: topic.label,
      mentionCount: agg.mentionCount,
      velocity: agg.mentionCount, // synchronous path uses raw count as a proxy
      sources: Array.from(agg.sources),
      score: agg.mentionCount,
    });
  });

  results.sort((a, b) => b.velocity - a.velocity);
  return results.slice(0, 20);
}

export async function getAlertsRows(
  now: number,
): Promise<
  Array<{
    topicId: string;
    topic: string;
    platform: Platform;
    velocity: number;
  }>
> {
  const grid: Array<Promise<{ topicId: string; topic: string; platform: Platform; velocity: number } | null>> = [];

  for (const topic of AI_TOPICS) {
    for (const platform of PLATFORMS) {
      grid.push(
        (async () => {
          const velocity = await computeVelocityForTopicPlatform(topic.id, platform, now);
          if (velocity === 0) return null;
          return {
            topicId: topic.id,
            topic: topic.label,
            platform,
            velocity,
          };
        })(),
      );
    }
  }

  const settled = await Promise.all(grid);
  return settled.filter((row): row is { topicId: string; topic: string; platform: Platform; velocity: number } => row !== null);
}

export function pickHeroCandidate(
  ranked: Record<Platform, TrendingTopic[]>,
): TrendingTopic | null {
  const top3 = (arr: TrendingTopic[]) => arr.slice(0, 3).map((t) => t.topic);
  const youtubeTop = new Set(top3(ranked.youtube ?? []));
  const redditTop = new Set(top3(ranked.reddit ?? []));
  const twitterTop = new Set(top3(ranked.twitter ?? []));

  const qualifying = new Set<string>();
  Array.from(youtubeTop).forEach((topic) => {
    if (redditTop.has(topic) && twitterTop.has(topic)) qualifying.add(topic);
  });
  if (qualifying.size === 0) return null;

  // Choose the topic with the highest aggregate velocity across the three platforms.
  let best: TrendingTopic | null = null;
  let bestAggregate = -Infinity;
  for (const topicName of Array.from(qualifying)) {
    const yt = ranked.youtube.find((t) => t.topic === topicName);
    const rd = ranked.reddit.find((t) => t.topic === topicName);
    const tw = ranked.twitter.find((t) => t.topic === topicName);
    const aggregate =
      (yt?.velocity ?? 0) + (rd?.velocity ?? 0) + (tw?.velocity ?? 0);

    if (aggregate > bestAggregate) {
      bestAggregate = aggregate;
      // Use the YouTube entry as the canonical "row" but rewrite velocity to aggregate so consumers can sort.
      const base = yt ?? rd ?? tw;
      if (base) {
        best = {
          ...base,
          velocity: aggregate,
          sources: Array.from(new Set([...(yt?.sources ?? []), ...(rd?.sources ?? []), ...(tw?.sources ?? [])])),
        };
      }
    }
  }
  return best;
}

export async function fetchAndCacheTrending(
  videos: Video[],
  posts: RedditPost[],
  tweets: Tweet[],
): Promise<TrendingTopic[]> {
  const items = extractTextItems(videos, posts, tweets);
  const counts = countMentionsByTopicPlatform(items);
  const now = Math.floor(Date.now() / 1000);

  await recordCountsToZsets(counts, now);

  // Read per-(topic, platform) velocities in parallel and build the final ranked list.
  const velocityGrid = await Promise.all(
    AI_TOPICS.flatMap((topic) =>
      PLATFORMS.map(async (platform) => {
        const velocity = await computeVelocityForTopicPlatform(topic.id, platform, now);
        return { topic, platform, velocity };
      }),
    ),
  );

  // Aggregate per topic across platforms.
  const perTopic = new Map<
    string,
    {
      label: string;
      mentionCount: number;
      velocity: number;
      sources: Set<Platform>;
    }
  >();
  for (const { topic, platform, velocity } of velocityGrid) {
    const compositeKey = `${topic.id}:${platform}`;
    const platformCount = counts.get(compositeKey) ?? 0;
    if (velocity === 0 && platformCount === 0) continue;

    const agg = perTopic.get(topic.id) ?? {
      label: topic.label,
      mentionCount: 0,
      velocity: 0,
      sources: new Set<Platform>(),
    };
    agg.mentionCount += platformCount;
    agg.velocity += velocity;
    if (platformCount > 0) agg.sources.add(platform);
    perTopic.set(topic.id, agg);
  }

  const topics: TrendingTopic[] = [];
  Array.from(perTopic.values()).forEach((agg) => {
    topics.push({
      topic: agg.label,
      mentionCount: agg.mentionCount,
      velocity: agg.velocity,
      sources: Array.from(agg.sources),
      score: agg.velocity,
    });
  });

  topics.sort((a, b) => b.velocity - a.velocity);
  const ranked = topics.slice(0, 20);

  await cacheSet(CACHE_KEYS.trending, ranked);
  await cacheSet(CACHE_KEYS.trendingRanked, ranked);

  return ranked;
}
