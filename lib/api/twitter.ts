import type { Tweet } from "@/lib/types";
import { TWITTER_USERS, CACHE_KEYS } from "@/lib/constants";
import { cacheSet } from "@/lib/cache/helpers";

interface XTweetData {
  id: string;
  text: string;
  created_at: string;
  author_id?: string;
  public_metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
  };
}

interface XUserData {
  id: string;
  name: string;
  username: string;
}

interface XApiResponse {
  data?: XTweetData[];
  includes?: { users?: XUserData[] };
}

const RETRY_STATUS = new Set([429, 503]);

// X API v2 /2/users/:id/tweets allows 15 requests / 15-min window on app-auth.
// With ~15 curated users that is the whole window, so fetch in sequential
// batches rather than one wide burst — a transient failure then retries
// without 15 simultaneous requests racing for the same quota.
const BATCH_SIZE = 5;

function jitterMs(): number {
  return 2000 + Math.floor(Math.random() * 3000);
}

async function fetchUserTimeline(
  user: { handle: string; userId: string },
  token: string,
): Promise<Tweet[]> {
  const url = `https://api.x.com/2/users/${user.userId}/tweets?max_results=10&tweet.fields=created_at,public_metrics&expansions=author_id&user.fields=name,username`;
  const headers = { Authorization: `Bearer ${token}` };

  let res = await fetch(url, { headers });

  if (RETRY_STATUS.has(res.status)) {
    const wait = jitterMs();
    console.warn(
      `[twitter] @${user.handle} got ${res.status}; retrying after ${wait}ms`,
    );
    await new Promise((r) => setTimeout(r, wait));
    res = await fetch(url, { headers });
  }

  if (!res.ok) {
    console.warn(
      `[twitter] Non-200 response for @${user.handle}: ${res.status} ${res.statusText}`,
    );
    return [];
  }

  const json: XApiResponse = await res.json();

  if (!json.data || !Array.isArray(json.data)) {
    console.warn(
      `[twitter] Unexpected response shape for @${user.handle}, skipping`,
    );
    return [];
  }

  const usersMap = new Map<string, string>();
  if (json.includes?.users) {
    for (const u of json.includes.users) {
      usersMap.set(u.id, u.name);
    }
  }

  return json.data
    .filter((tweet) => tweet.public_metrics)
    .map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      authorName:
        (tweet.author_id && usersMap.get(tweet.author_id)) ?? user.handle,
      authorHandle: user.handle,
      createdAt: tweet.created_at,
      likeCount: tweet.public_metrics.like_count,
      retweetCount: tweet.public_metrics.retweet_count,
      url: `https://x.com/${user.handle}/status/${tweet.id}`,
    }));
}

export async function fetchTweets(): Promise<Tweet[]> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    console.warn("[twitter] X_BEARER_TOKEN not set, skipping fetch");
    return [];
  }

  const allTweets: Tweet[] = [];

  for (let i = 0; i < TWITTER_USERS.length; i += BATCH_SIZE) {
    const batch = TWITTER_USERS.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((user) => fetchUserTimeline(user, token)),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        allTweets.push(...result.value);
      } else {
        console.warn("[twitter] A user fetch rejected:", result.reason);
      }
    }
  }

  allTweets.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  await cacheSet(CACHE_KEYS.twitter, allTweets);

  return allTweets;
}
