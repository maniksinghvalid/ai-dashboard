import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { fetchYouTubeVideos } from "@/lib/api/youtube";
import { fetchRedditPosts } from "@/lib/api/reddit";
import { fetchTweets } from "@/lib/api/twitter";
import { fetchNews } from "@/lib/api/news";
import { fetchAndCacheTrending, getAlertsRows } from "@/lib/api/trending";
import { promoteHero } from "@/lib/api/hero";
import { writeSpikeAlertsFromTrending } from "@/lib/api/alerts";
import { fetchAndCacheSentiment } from "@/lib/api/sentiment";
import { deriveSourceOutcome, type SourceOutcome } from "@/lib/cron/summary";
import { acquireLock, releaseLock } from "@/lib/cache/lock";
import type { Video, RedditPost, Tweet } from "@/lib/types";

function captureIfSentry(err: unknown, label: string) {
  console.error(`[cron] ${label} failed:`, err);
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    // Tag every capture with its source label so cron failures stay
    // machine-filterable in Sentry — without each callee self-capturing.
    Sentry.captureException(err, { tags: { cronSource: label } });
  }
}

async function refreshAllFeeds() {
  // Distributed lock: a second concurrent invocation (QStash retrying a
  // failed/timed-out delivery) returns early instead of racing the 3-tier DAG
  // on ZSET windows + the sentiment budget. The lock's EX TTL is the backstop
  // if this function is hard-killed before `finally` runs releaseLock.
  const lockValue = await acquireLock();
  if (lockValue === null) {
    // HTTP 200 (not 4xx/5xx): a 5xx would make QStash retry the contended call
    // and re-contend forever; 200 tells QStash the delivery succeeded.
    return NextResponse.json({ status: "locked" }, { status: 200 });
  }

  try {
    // Tier 1 sources report a three-state outcome (written / skipped_empty /
    // fetcher_threw) via deriveSourceOutcome. Tier 2/3 keep the binary ok/failed.
    // The type encodes that Tier-boundary invariant so a future edit can't assign
    // a Tier 1 outcome to a Tier 2/3 key (or vice versa).
    const summary: {
      youtube: SourceOutcome;
      reddit: SourceOutcome;
      twitter: SourceOutcome;
      news: SourceOutcome;
      trending: "ok" | "failed";
      hero: "ok" | "failed";
      alerts: "ok" | "failed";
      sentiment: "ok" | "failed";
    } = {
      youtube: "fetcher_threw",
      reddit: "fetcher_threw",
      twitter: "fetcher_threw",
      news: "fetcher_threw",
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

    summary.youtube = deriveSourceOutcome(ytResult);
    if (ytResult.status === "fulfilled") {
      videos = ytResult.value;
    } else {
      captureIfSentry(ytResult.reason, "YouTube fetch");
    }

    summary.reddit = deriveSourceOutcome(redditResult);
    if (redditResult.status === "fulfilled") {
      posts = redditResult.value;
    } else {
      captureIfSentry(redditResult.reason, "Reddit fetch");
    }

    summary.twitter = deriveSourceOutcome(twitterResult);
    if (twitterResult.status === "fulfilled") {
      tweets = twitterResult.value;
    } else {
      captureIfSentry(twitterResult.reason, "Twitter fetch");
    }

    summary.news = deriveSourceOutcome(newsResult);
    if (newsResult.status === "rejected") {
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

    const [heroResult, alertsResult, sentimentResult] =
      await Promise.allSettled([
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
  } finally {
    // Release on both the normal-completion and throw paths. The EX TTL is the
    // backstop if the function is hard-killed before this runs.
    // Wrap in try/catch: a releaseLock rejection (Redis blip) must not replace
    // a real tier error as the promise rejection — a failed release is
    // non-fatal (the 90s TTL self-heals), so we capture it instead of letting
    // it clobber the original error.
    try {
      await releaseLock(lockValue);
    } catch (err) {
      captureIfSentry(err, "lock release");
    }
  }
}

// GET — manual trigger with Bearer token (also reachable by a Vercel cron if re-added)
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
