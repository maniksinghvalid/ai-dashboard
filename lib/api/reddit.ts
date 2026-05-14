import RSSParser from "rss-parser";
import type { RedditPost } from "@/lib/types";
import { SUBREDDITS, CACHE_KEYS, type SubredditConfig } from "@/lib/constants";
import { cacheSet } from "@/lib/cache/helpers";

// Reddit's anonymous JSON API (www.reddit.com/r/*/hot.json) is 403-blocked from
// datacenter IPs (Vercel functions). The .rss (Atom) feed is a separate
// syndication path and is the chosen replacement (see 03-05-PLAN.md).
//
// Atom carries title / link / author / timestamp only — it does NOT carry score,
// comment count, or structured flair. So the prior NSFW / stickied / flair-allowlist
// filtering retired with this switch; RSS has no fields to filter on. Acceptable
// because all five configured subreddits are SFW. A stickied thread may now appear
// in the feed — a minor, tolerated cosmetic difference.

const DEFAULT_USER_AGENT =
  "aip-dash/1.0 (https://github.com/maniksinghvalid/ai-dashboard)";
const USER_AGENT = process.env.REDDIT_USER_AGENT || DEFAULT_USER_AGENT;
// Best-effort on the .rss path — Reddit's RSS feeds cap around 25 entries and
// may ignore ?limit entirely (unlike the JSON API, where it was authoritative).
const PER_SUBREDDIT_LIMIT = 25;

// Title-based AI-relevance filter for general-purpose subreddits (those with
// `aiFilter: true` in SUBREDDITS — e.g. r/programming). Word-boundary match so
// "ai" hits "AI" but not "rain"/"detail"; the optional `s?` catches plurals
// like "LLMs"/"GPTs"/"models". Applied per-subreddit before caching.
const AI_KEYWORD_RE =
  /\b(?:llms?|ai|gpts?|claude|models?|neural|transformers?)\b/i;

// rss-parser's parsed Atom item — only the fields this normalizer reads.
interface AtomItem {
  id?: string;
  title?: string;
  link?: string;
  author?: string;
  isoDate?: string;
  pubDate?: string;
}

export function normalizeRedditAtomEntry(
  item: AtomItem,
  subreddit: string,
): RedditPost {
  // Reddit's Atom <id> is "t3_xxxxx" — strip the t3_ type prefix for a clean id.
  const rawId = item.id ?? "";
  const id = rawId.replace(/^t3_/, "") || rawId;
  // Atom <author><name> is "/u/username" — strip the /u/ prefix.
  const author = (item.author ?? "").replace(/^\/u\//, "") || "unknown";
  return {
    id,
    title: item.title ?? "Untitled",
    author,
    subreddit,
    // Atom <link> is the Reddit comments permalink. Unlike the old JSON path,
    // RSS does not expose the external link-post URL — the permalink is what the
    // feed reliably provides.
    url: item.link ?? `https://www.reddit.com/r/${subreddit}/`,
    createdAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
  };
}

const RETRY_STATUS = new Set([429, 503]);

function jitterMs(): number {
  return 2000 + Math.floor(Math.random() * 3000);
}

async function fetchOnce(sub: string): Promise<Response> {
  const url = `https://www.reddit.com/r/${sub}/hot.rss?limit=${PER_SUBREDDIT_LIMIT}`;
  return fetch(url, { headers: { "User-Agent": USER_AGENT } });
}

async function fetchSubreddit(
  parser: RSSParser,
  sub: SubredditConfig,
): Promise<RedditPost[]> {
  let res = await fetchOnce(sub.slug);

  if (RETRY_STATUS.has(res.status)) {
    const wait = jitterMs();
    console.warn(
      `[reddit] r/${sub.slug} got ${res.status}; retrying after ${wait}ms`,
    );
    await new Promise((r) => setTimeout(r, wait));
    res = await fetchOnce(sub.slug);
  }

  if (!res.ok) {
    console.warn(
      `[reddit] Non-200 response for r/${sub.slug}: ${res.status} ${res.statusText}`,
    );
    return [];
  }

  const xml = await res.text();
  const feed = await parser.parseString(xml);

  const posts = (feed.items ?? []).map((item) =>
    normalizeRedditAtomEntry(item as AtomItem, sub.slug),
  );

  // Config-driven AI filter: only subreddits flagged `aiFilter` are narrowed.
  return sub.aiFilter
    ? posts.filter((post) => AI_KEYWORD_RE.test(post.title))
    : posts;
}

export async function fetchRedditPosts(): Promise<RedditPost[]> {
  const parser = new RSSParser();

  const results = await Promise.allSettled(
    SUBREDDITS.map((sub) => fetchSubreddit(parser, sub)),
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
