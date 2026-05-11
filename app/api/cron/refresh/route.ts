import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { fetchYouTubeVideos } from "@/lib/api/youtube";
import { fetchRedditPosts } from "@/lib/api/reddit";
import { fetchTweets } from "@/lib/api/twitter";
import { fetchNews } from "@/lib/api/news";
import { fetchAndCacheTrending, getAlertsRows } from "@/lib/api/trending";
import { promoteHero } from "@/lib/api/hero";
import { writeSpikeAlertsFromTrending } from "@/lib/api/alerts";
import { fetchAndCacheSentiment } from "@/lib/api/sentiment";
import type { Video, RedditPost, Tweet } from "@/lib/types";

function captureIfSentry(err: unknown, label: string) {
  console.error(`[cron] ${label} failed:`, err);
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(err);
  }
}

async function refreshAllFeeds() {
  const summary: Record<string, "ok" | "failed"> = {
    youtube: "failed",
    reddit: "failed",
    twitter: "failed",
    news: "failed",
    trending: "failed",
    hero: "failed",
    alerts: "failed",
    sentiment: "failed",
  };

  // ─── Tier 1: parallel external fetches ──────────────────────────────────
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
    captureIfSentry(ytResult.reason, "YouTube fetch");
  }

  if (redditResult.status === "fulfilled") {
    posts = redditResult.value;
    summary.reddit = "ok";
  } else {
    captureIfSentry(redditResult.reason, "Reddit fetch");
  }

  if (twitterResult.status === "fulfilled") {
    tweets = twitterResult.value;
    summary.twitter = "ok";
  } else {
    captureIfSentry(twitterResult.reason, "Twitter fetch");
  }

  if (newsResult.status === "fulfilled") {
    summary.news = "ok";
  } else {
    captureIfSentry(newsResult.reason, "News fetch");
  }

  // ─── Tier 2: trending tally → ZSETs + ranked cache (depends on Tier 1) ──
  const trendingSettled = await Promise.allSettled([
    fetchAndCacheTrending(videos, posts, tweets),
  ]);
  const trendingOutcome = trendingSettled[0];
  if (trendingOutcome.status === "fulfilled") {
    summary.trending = "ok";
  } else {
    captureIfSentry(trendingOutcome.reason, "Tier 2 trending");
  }

  // ─── Tier 3: hero ‖ alerts ‖ sentiment (depend on Tier 2 ZSETs) ─────────
  const now = Math.floor(Date.now() / 1000);

  // Canonical alerts rows from plan 05's getAlertsRows — never reconstruct topicId inline.
  let rowsForAlerts: Awaited<ReturnType<typeof getAlertsRows>> = [];
  try {
    rowsForAlerts = await getAlertsRows(now);
  } catch (err) {
    captureIfSentry(err, "Tier 3 getAlertsRows");
    rowsForAlerts = [];
  }

  const itemsForSentiment: Array<{ text: string }> = [
    ...posts.map((p) => ({ text: p.title })),
    ...tweets.map((t) => ({ text: t.text })),
  ];

  const [heroResult, alertsResult, sentimentResult] = await Promise.allSettled([
    promoteHero(),
    writeSpikeAlertsFromTrending(rowsForAlerts),
    fetchAndCacheSentiment(itemsForSentiment),
  ]);

  if (heroResult.status === "fulfilled") {
    summary.hero = "ok";
  } else {
    captureIfSentry(heroResult.reason, "Tier 3 hero");
  }

  if (alertsResult.status === "fulfilled") {
    summary.alerts = "ok";
  } else {
    captureIfSentry(alertsResult.reason, "Tier 3 alerts");
  }

  if (sentimentResult.status === "fulfilled") {
    summary.sentiment = "ok";
  } else {
    captureIfSentry(sentimentResult.reason, "Tier 3 sentiment");
  }

  return NextResponse.json({
    status: "ok",
    refreshedAt: new Date().toISOString(),
    summary,
  });
}

// GET — Vercel cron (daily) + manual trigger with Bearer token
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${cronSecret}`) {
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
