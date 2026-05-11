import { cacheGet, cacheSet } from "@/lib/cache/helpers";
import { CACHE_KEYS, CACHE_MAX_AGE } from "@/lib/constants";
import { pickHeroCandidate } from "@/lib/api/trending";
import type {
  TrendingTopic,
  HeroStory,
  Video,
  RedditPost,
  Tweet,
  NewsItem,
} from "@/lib/types";

type Platform = "youtube" | "reddit" | "twitter";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function promoteHero(): Promise<HeroStory | null> {
  const rankedCached = await cacheGet<TrendingTopic[]>(
    CACHE_KEYS.trendingRanked,
    CACHE_MAX_AGE.tenMin,
  );
  if (!rankedCached || !rankedCached.data) return null;

  const perPlatform: Record<Platform, TrendingTopic[]> = {
    youtube: [],
    reddit: [],
    twitter: [],
  };
  for (const topic of rankedCached.data) {
    for (const src of topic.sources) {
      if (src === "youtube" || src === "reddit" || src === "twitter") {
        perPlatform[src as Platform].push(topic);
      }
    }
  }

  const candidate = pickHeroCandidate(perPlatform);
  if (!candidate) {
    console.log("[hero] no top-3-on-all-3 candidate this cycle");
    return null;
  }

  const [videosRes, redditRes, tweetsRes, newsRes] = await Promise.all([
    cacheGet<Video[]>(CACHE_KEYS.youtube, CACHE_MAX_AGE.default),
    cacheGet<RedditPost[]>(CACHE_KEYS.reddit, CACHE_MAX_AGE.default),
    cacheGet<Tweet[]>(CACHE_KEYS.twitter, CACHE_MAX_AGE.default),
    cacheGet<NewsItem[]>(CACHE_KEYS.news, CACHE_MAX_AGE.default),
  ]);

  const videos = videosRes?.data ?? null;
  const redditPosts = redditRes?.data ?? null;
  // tweets currently only contribute to ranking via the trending leg; the variable
  // is referenced here for completeness but the fusion does not match tweets for
  // headline/link content per REQ-hero-auto-promotion wording.
  void tweetsRes;
  const newsItems = newsRes?.data ?? null;

  const re = new RegExp(`\\b${escapeRegex(candidate.topic)}\\b`, "i");
  const matchingNews = newsItems?.find((n) => re.test(n.title)) ?? null;
  const matchingPost = redditPosts?.find((p) => re.test(p.title)) ?? null;
  const matchingVideo = videos?.find((v) => re.test(v.title)) ?? null;

  const hero: HeroStory = {
    topic: candidate.topic,
    mentionCount: candidate.mentionCount,
    velocity: candidate.velocity,
    sources: candidate.sources,
    score: candidate.score,
    headline:
      matchingNews?.title ??
      matchingPost?.title ??
      matchingVideo?.title ??
      `${candidate.topic} is trending across YouTube, Reddit, and X`,
    thumbnailUrl: matchingVideo?.thumbnailUrl ?? null,
    link:
      matchingNews?.link ?? matchingPost?.url ?? matchingVideo?.url ?? null,
  };

  await cacheSet(CACHE_KEYS.hero, hero);
  return hero;
}
