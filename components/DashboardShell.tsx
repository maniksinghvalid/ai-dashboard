"use client";

import { useDashboard } from "@/lib/hooks/use-dashboard";
import { Header } from "@/components/Header";
import { LiveTicker } from "@/components/LiveTicker";
import { DataSourcesFooter } from "@/components/DataSourcesFooter";
import { WidgetErrorBoundary } from "@/components/widgets/WidgetErrorBoundary";
import { YouTubeWidget } from "@/components/widgets/YouTubeWidget";
import { RedditWidget } from "@/components/widgets/RedditWidget";
import { XFeedWidget } from "@/components/widgets/XFeedWidget";
import { TrendingWidget } from "@/components/widgets/TrendingWidget";
import { HeroStoryCard } from "@/components/widgets/HeroStoryCard";
import { NewsWidget } from "@/components/widgets/NewsWidget";
import { SentimentWidget } from "@/components/widgets/SentimentWidget";

export function DashboardShell() {
  const { youtube, reddit, twitter, news, trending, sentiment, hero } =
    useDashboard();

  return (
    <div className="relative z-[1] min-h-screen bg-background">
      <Header />
      <LiveTicker topics={trending.data} />

      <main className="mx-auto grid max-w-[1280px] grid-cols-1 gap-3.5 px-5 py-4 lg:grid-cols-2 xl:grid-cols-[280px_1fr_280px]">
        {/* Left Column: YouTube + Reddit */}
        <div className="flex flex-col gap-3.5">
          <WidgetErrorBoundary fallbackTitle="YouTube feed unavailable">
            <YouTubeWidget
              videos={youtube.data}
              stale={youtube.stale}
              isLoading={youtube.isLoading}
              error={youtube.error}
            />
          </WidgetErrorBoundary>

          <WidgetErrorBoundary fallbackTitle="Reddit feed unavailable">
            <RedditWidget
              posts={reddit.data}
              stale={reddit.stale}
              isLoading={reddit.isLoading}
              error={reddit.error}
            />
          </WidgetErrorBoundary>
        </div>

        {/* Center Column: Hero + Trending + Sentiment */}
        <div className="flex flex-col gap-3.5">
          <WidgetErrorBoundary fallbackTitle="Story unavailable">
            <HeroStoryCard
              topics={trending.data}
              videos={youtube.data}
              news={news.data}
              isLoading={trending.isLoading}
              stale={trending.stale || youtube.stale || news.stale}
              apiHero={hero.data}
            />
          </WidgetErrorBoundary>

          <WidgetErrorBoundary fallbackTitle="Trending unavailable">
            <TrendingWidget
              topics={trending.data}
              stale={trending.stale}
              isLoading={trending.isLoading}
              error={trending.error}
            />
          </WidgetErrorBoundary>

          <WidgetErrorBoundary fallbackTitle="Sentiment unavailable">
            <SentimentWidget
              data={sentiment.data}
              stale={sentiment.stale}
              isLoading={sentiment.isLoading}
              error={sentiment.error}
            />
          </WidgetErrorBoundary>
        </div>

        {/* Right Column: X + News */}
        <div className="flex flex-col gap-3.5">
          <WidgetErrorBoundary fallbackTitle="X feed unavailable">
            <XFeedWidget
              tweets={twitter.data}
              stale={twitter.stale}
              isLoading={twitter.isLoading}
              error={twitter.error}
            />
          </WidgetErrorBoundary>

          <WidgetErrorBoundary fallbackTitle="News feed unavailable">
            <NewsWidget
              items={news.data}
              stale={news.stale}
              isLoading={news.isLoading}
              error={news.error}
            />
          </WidgetErrorBoundary>
        </div>
      </main>

      <DataSourcesFooter />
    </div>
  );
}
