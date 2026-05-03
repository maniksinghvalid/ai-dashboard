"use client";

import { useDashboard } from "@/lib/hooks/use-dashboard";
import { Header } from "@/components/Header";
import { LiveTicker } from "@/components/LiveTicker";
import { WidgetErrorBoundary } from "@/components/widgets/WidgetErrorBoundary";
import { YouTubeWidget } from "@/components/widgets/YouTubeWidget";
import { RedditWidget } from "@/components/widgets/RedditWidget";
import { XFeedWidget } from "@/components/widgets/XFeedWidget";
import { TrendingWidget } from "@/components/widgets/TrendingWidget";
import { HeroStoryCard } from "@/components/widgets/HeroStoryCard";
import { NewsWidget } from "@/components/widgets/NewsWidget";

export function DashboardShell() {
  const { youtube, reddit, twitter, news, trending } = useDashboard();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <LiveTicker topics={trending.data} />

      <main className="mx-auto max-w-[1440px] p-4 lg:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          {/* Left Column: YouTube + Reddit */}
          <div className="space-y-4 lg:space-y-6">
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

          {/* Center Column: Hero + Trending */}
          <div className="space-y-4 lg:space-y-6">
            <WidgetErrorBoundary fallbackTitle="Story unavailable">
              <HeroStoryCard
                topics={trending.data}
                videos={youtube.data}
                news={news.data}
                isLoading={trending.isLoading}
                stale={trending.stale || youtube.stale || news.stale}
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

            {/* SentimentBar placeholder — SCRUM-42 */}
          </div>

          {/* Right Column: X + News */}
          <div className="space-y-4 lg:space-y-6">
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
        </div>
      </main>
    </div>
  );
}
