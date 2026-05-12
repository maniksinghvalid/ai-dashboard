import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cache/helpers", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api/trending", () => ({
  pickHeroCandidate: vi.fn(),
}));

import { promoteHero } from "@/lib/api/hero";
import { cacheGet, cacheSet } from "@/lib/cache/helpers";
import { pickHeroCandidate } from "@/lib/api/trending";
import { CACHE_KEYS } from "@/lib/constants";

const CANDIDATE = {
  topic: "Claude",
  mentionCount: 30,
  velocity: 5,
  sources: ["youtube", "reddit", "twitter"],
  score: 5,
};

function programCaches(opts: {
  ranked?: unknown;
  videos?: unknown;
  posts?: unknown;
  tweets?: unknown;
  news?: unknown;
}) {
  vi.mocked(cacheGet).mockImplementation(async (key: string) => {
    const map: Record<string, unknown> = {
      [CACHE_KEYS.trendingRanked]: opts.ranked,
      [CACHE_KEYS.youtube]: opts.videos,
      [CACHE_KEYS.reddit]: opts.posts,
      [CACHE_KEYS.twitter]: opts.tweets,
      [CACHE_KEYS.news]: opts.news,
    };
    const data = map[key];
    if (data === undefined) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { data, fetchedAt: new Date().toISOString(), stale: false } as any;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(pickHeroCandidate).mockReturnValue(CANDIDATE as any);
});

describe("promoteHero", () => {
  it("ALL SOURCES PRESENT → news wins headline + link", async () => {
    programCaches({
      ranked: [{ ...CANDIDATE }],
      videos: [{ title: "Claude 4 review", url: "https://yt.example/c", thumbnailUrl: "https://thumb" }],
      posts: [{ title: "Claude post wins", url: "https://reddit.example/c" }],
      tweets: [{ text: "Claude tweet" }],
      news: [{ title: "Claude 4 launches today", link: "https://news.example/c" }],
    });

    const hero = await promoteHero();
    expect(hero).not.toBeNull();
    expect(hero?.headline).toBe("Claude 4 launches today");
    expect(hero?.link).toBe("https://news.example/c");
    expect(hero?.thumbnailUrl).toBe("https://thumb");
    expect(cacheSet).toHaveBeenCalledTimes(1);
  });

  it("REDDIT-ONLY FALLBACK — news missing → reddit post wins headline AND link", async () => {
    programCaches({
      ranked: [{ ...CANDIDATE }],
      videos: [{ title: "Claude 4 review", url: "https://yt.example/c", thumbnailUrl: "https://thumb" }],
      posts: [{ title: "Claude 4 launches with new context window", url: "https://reddit.example/r" }],
      tweets: [],
      news: [], // no match
    });

    const hero = await promoteHero();
    expect(hero?.headline).toBe("Claude 4 launches with new context window");
    expect(hero?.link).toBe("https://reddit.example/r");
  });

  it("VIDEO-ONLY FALLBACK — news + reddit missing → video wins", async () => {
    programCaches({
      ranked: [{ ...CANDIDATE }],
      videos: [{ title: "Claude 4 deep dive", url: "https://yt.example/v", thumbnailUrl: "https://thumb-v" }],
      posts: [],
      tweets: [],
      news: [],
    });

    const hero = await promoteHero();
    expect(hero?.headline).toBe("Claude 4 deep dive");
    expect(hero?.link).toBe("https://yt.example/v");
    expect(hero?.thumbnailUrl).toBe("https://thumb-v");
  });

  it("SYNTHESIZED HEADLINE — all sources empty", async () => {
    programCaches({
      ranked: [{ ...CANDIDATE }],
      videos: [],
      posts: [],
      tweets: [],
      news: [],
    });

    const hero = await promoteHero();
    expect(hero?.headline.includes("trending across YouTube, Reddit, and X")).toBe(true);
    expect(hero?.link).toBeNull();
    expect(hero?.thumbnailUrl).toBeNull();
  });

  it("NO CANDIDATE — returns null and does NOT call cacheSet", async () => {
    programCaches({
      ranked: [{ ...CANDIDATE }],
      videos: [],
      posts: [],
      tweets: [],
      news: [],
    });
    vi.mocked(pickHeroCandidate).mockReturnValue(null);

    const hero = await promoteHero();
    expect(hero).toBeNull();
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("NO RANKED DATA — returns null without calling pickHeroCandidate", async () => {
    // Ranked cache miss
    vi.mocked(cacheGet).mockResolvedValue(null);

    const hero = await promoteHero();
    expect(hero).toBeNull();
    expect(pickHeroCandidate).not.toHaveBeenCalled();
  });
});
