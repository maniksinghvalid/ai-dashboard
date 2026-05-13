import type { RedditPost } from "@/lib/types";
import { SUBREDDITS, CACHE_KEYS, REDDIT_FLAIR_ALLOWLIST } from "@/lib/constants";
import { cacheSet } from "@/lib/cache/helpers";

const DEFAULT_USER_AGENT =
  "aip-dash/1.0 (https://github.com/maniksinghvalid/ai-dashboard)";
const USER_AGENT = process.env.REDDIT_USER_AGENT || DEFAULT_USER_AGENT;
const PER_SUBREDDIT_LIMIT = 25;

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

interface RedditJsonResponse {
  data?: {
    children?: Array<{ kind: string; data: RedditJsonChild }>;
  };
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

function isFlairAllowed(post: RedditPost): boolean {
  if (!post.flair) return true;
  const lower = post.flair.toLowerCase();
  return REDDIT_FLAIR_ALLOWLIST.some((allowed) =>
    lower.includes(allowed.toLowerCase()),
  );
}

const RETRY_STATUS = new Set([429, 503]);

function jitterMs(): number {
  return 2000 + Math.floor(Math.random() * 3000);
}

async function fetchOnce(sub: string): Promise<Response> {
  const url = `https://www.reddit.com/r/${sub}/hot.json?limit=${PER_SUBREDDIT_LIMIT}`;
  return fetch(url, { headers: { "User-Agent": USER_AGENT } });
}

async function fetchSubreddit(sub: string): Promise<RedditPost[]> {
  let res = await fetchOnce(sub);

  if (RETRY_STATUS.has(res.status)) {
    const wait = jitterMs();
    console.warn(
      `[reddit] r/${sub} got ${res.status}; retrying after ${wait}ms`,
    );
    await new Promise((r) => setTimeout(r, wait));
    res = await fetchOnce(sub);
  }

  if (!res.ok) {
    console.warn(
      `[reddit] Non-200 response for r/${sub}: ${res.status} ${res.statusText}`,
    );
    return [];
  }

  const json = (await res.json()) as RedditJsonResponse;
  const children = json.data?.children ?? [];

  return children
    .filter((c) => c.kind === "t3")
    .map((c) => c.data)
    .filter(isPostKeepable)
    .map(normalizeRedditJsonPost)
    .filter(isFlairAllowed);
}

export async function fetchRedditPosts(): Promise<RedditPost[]> {
  const results = await Promise.allSettled(
    SUBREDDITS.map((sub) => fetchSubreddit(sub)),
  );

  const posts: RedditPost[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      posts.push(...result.value);
    } else {
      console.warn("[reddit] subreddit fetch rejected:", result.reason);
    }
  }

  await cacheSet(CACHE_KEYS.reddit, posts);

  return posts;
}
