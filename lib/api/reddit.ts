import { ApifyClient } from "apify-client";

import type { RedditPost } from "@/lib/types";
import {
  SUBREDDITS,
  CACHE_KEYS,
  APIFY_ACTOR_ID,
  REDDIT_FLAIR_ALLOWLIST,
} from "@/lib/constants";
import { cacheSet } from "@/lib/cache/helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface RedditJsonChild {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  score: number;
  num_comments: number;
  link_flair_text: string | null;
  permalink: string;
  url: string;
  created_utc: number;
  stickied: boolean;
  over_18: boolean;
}

export function normalizeRedditJsonPost(raw: RedditJsonChild): RedditPost {
  const flair =
    raw.link_flair_text && raw.link_flair_text.length > 0
      ? raw.link_flair_text
      : null;

  return {
    id: raw.id,
    title: raw.title,
    author: raw.author,
    subreddit: raw.subreddit,
    score: raw.score,
    numComments: raw.num_comments,
    flair,
    // Reddit's `url` is the external link for link-posts and the discussion
    // URL for self-posts — matches what the Apify path returned. Fall back to
    // the constructed permalink URL if `url` is somehow absent.
    url: raw.url || `https://www.reddit.com${raw.permalink}`,
    createdAt: new Date(raw.created_utc * 1000).toISOString(),
  };
}

export function isPostKeepable(raw: RedditJsonChild): boolean {
  return !raw.stickied && !raw.over_18;
}

/**
 * Normalize a raw Apify item into the RedditPost shape.
 * The Apify Reddit scraper uses varying field names across versions,
 * so we check multiple possible keys for each property.
 */
function normalizeApifyPost(item: Record<string, any>): RedditPost {
  const rawSubreddit: string =
    item.parsedCommunityName ?? item.communityName ?? item.community ?? item.subreddit ?? item.subredditName ?? "";
  const subreddit = rawSubreddit.replace(/^r\//, "");

  return {
    id: String(item.id ?? item.dataId ?? ""),
    title: String(item.title ?? ""),
    author: String(item.username ?? item.author ?? item.authorName ?? ""),
    subreddit,
    score: Number(item.upVotes ?? item.score ?? 0),
    numComments: Number(
      item.numberOfComments ?? item.numComments ?? item.commentCount ?? 0,
    ),
    flair: item.flair ?? item.flairText ?? null,
    url: String(item.url ?? item.link ?? ""),
    createdAt: String(item.createdAt ?? item.scrapedAt ?? new Date().toISOString()),
  };
}

/**
 * Returns true if the post should be kept based on flair filtering.
 * Posts without flair are always kept. Posts with flair are kept only
 * when the flair text partially matches (case-insensitive) any entry
 * in REDDIT_FLAIR_ALLOWLIST.
 */
function isFlairAllowed(post: RedditPost): boolean {
  if (!post.flair) return true;

  const lower = post.flair.toLowerCase();
  return REDDIT_FLAIR_ALLOWLIST.some((allowed) =>
    lower.includes(allowed.toLowerCase()),
  );
}

/**
 * Fetch hot Reddit posts via the Apify Reddit scraper, normalize results,
 * filter by flair allowlist, cache, and return.
 */
export async function fetchRedditPosts(): Promise<RedditPost[]> {
  if (!process.env.APIFY_API_TOKEN) {
    console.warn("[reddit] APIFY_API_TOKEN not set, skipping fetch");
    return [];
  }

  const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

  const run = await client.actor(APIFY_ACTOR_ID).call(
    {
      startUrls: SUBREDDITS.map((s) => ({
        url: `https://www.reddit.com/r/${s}/hot/`,
      })),
      maxItems: 500,
      sort: "hot",
    },
    { waitSecs: 45 },
  );

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  const posts: RedditPost[] = (items as Record<string, any>[])
    .filter((item) => item.dataType !== "comment")
    .map(normalizeApifyPost)
    .filter(isFlairAllowed);

  await cacheSet(CACHE_KEYS.reddit, posts);

  return posts;
}
