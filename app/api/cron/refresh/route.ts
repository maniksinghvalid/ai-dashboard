import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import * as Sentry from "@sentry/nextjs";
import { fetchYouTubeVideos } from "@/lib/api/youtube";
import { fetchRedditPosts } from "@/lib/api/reddit";
import { fetchTweets } from "@/lib/api/twitter";
import { fetchNews } from "@/lib/api/news";
import { fetchAndCacheTrending } from "@/lib/api/trending";
import type { Video, RedditPost, Tweet } from "@/lib/types";

async function refreshAllFeeds() {
  const summary: Record<string, "ok" | "failed"> = {
    youtube: "failed",
    reddit: "failed",
    twitter: "failed",
    news: "failed",
    trending: "failed",
  };

  const [ytResult, redditResult, twitterResult, newsResult] =
    await Promise.allSettled([
      fetchYouTubeVideos(),
      fetchRedditPosts(),
      fetchTweets(),
      fetchNews(),
    ]);

  let videos: Video[] = [];
  let posts: RedditPost[] = [];
  let tweets: Tweet[] = [];

  if (ytResult.status === "fulfilled") {
    videos = ytResult.value;
    summary.youtube = "ok";
  } else {
    console.error("[cron] YouTube fetch failed:", ytResult.reason);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(ytResult.reason);
    }
  }

  if (redditResult.status === "fulfilled") {
    posts = redditResult.value;
    summary.reddit = "ok";
  } else {
    console.error("[cron] Reddit fetch failed:", redditResult.reason);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(redditResult.reason);
    }
  }

  if (twitterResult.status === "fulfilled") {
    tweets = twitterResult.value;
    summary.twitter = "ok";
  } else {
    console.error("[cron] Twitter fetch failed:", twitterResult.reason);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(twitterResult.reason);
    }
  }

  if (newsResult.status === "fulfilled") {
    summary.news = "ok";
  } else {
    console.error("[cron] News fetch failed:", newsResult.reason);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(newsResult.reason);
    }
  }

  if (videos.length > 0 || posts.length > 0 || tweets.length > 0) {
    try {
      await fetchAndCacheTrending(videos, posts, tweets);
      summary.trending = "ok";
    } catch (err) {
      console.error("[cron] Trending calculation failed:", err);
      if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
        Sentry.captureException(err);
      }
    }
  }

  return NextResponse.json({
    status: "ok",
    refreshedAt: new Date().toISOString(),
    summary,
  });
}

// GET — Vercel cron (daily) + manual trigger with Bearer token
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return refreshAllFeeds();
}

// POST — QStash scheduled invocation (every 15 min)
// Signature verification uses QSTASH_CURRENT_SIGNING_KEY + QSTASH_NEXT_SIGNING_KEY env vars
export async function POST(request: NextRequest) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentSigningKey || !nextSigningKey) {
    return NextResponse.json(
      { error: "QStash signing keys not configured" },
      { status: 500 },
    );
  }

  const receiver = new Receiver({ currentSigningKey, nextSigningKey });
  const signature = request.headers.get("upstash-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const body = await request.text();

  try {
    await receiver.verify({ signature, body });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  return refreshAllFeeds();
}
