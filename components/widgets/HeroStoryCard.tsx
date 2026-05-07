import Image from "next/image";
import type { Video, NewsItem, TrendingTopic, HeroStory } from "@/lib/types";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
import { PlatformBadge } from "@/components/ui/PlatformBadge";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function deriveHeroStory(
  topics: TrendingTopic[] | null,
  videos: Video[] | null,
  news: NewsItem[] | null,
): HeroStory | null {
  if (!topics || topics.length === 0) return null;

  const top = topics[0];
  const re = new RegExp(`\\b${escapeRegex(top.topic)}\\b`, "i");

  const matchingVideo = videos?.find((v) => re.test(v.title));
  const matchingNews = news?.find((n) => re.test(n.title));

  return {
    topic: top.topic,
    mentionCount: top.mentionCount,
    velocity: top.velocity,
    sources: top.sources,
    score: top.score,
    headline:
      matchingNews?.title ??
      matchingVideo?.title ??
      `${top.topic} is trending`,
    thumbnailUrl: matchingVideo?.thumbnailUrl ?? null,
    link: matchingNews?.link ?? matchingVideo?.url ?? null,
  };
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function HeroStoryCard({
  topics,
  videos,
  news,
  isLoading,
  stale = false,
}: {
  topics: TrendingTopic[] | null;
  videos: Video[] | null;
  news: NewsItem[] | null;
  isLoading: boolean;
  stale?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-widget border border-accent-500/30 bg-gradient-to-br from-accent-950/50 to-surface p-widget-lg">
        <WidgetSkeleton lines={3} />
      </div>
    );
  }

  const hero = deriveHeroStory(topics, videos, news);

  if (!hero) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-widget border border-white/10 bg-surface p-widget">
        <p className="text-sm text-gray-500">No trending stories</p>
      </div>
    );
  }

  const safeLink = hero.link && isValidUrl(hero.link) ? hero.link : null;
  const Wrapper = safeLink ? "a" : "div";
  const linkProps = safeLink
    ? {
        href: safeLink,
        target: "_blank" as const,
        rel: "noopener noreferrer",
      }
    : {};

  return (
    <Wrapper
      {...linkProps}
      className="group relative block overflow-hidden rounded-widget border border-accent-500/30 bg-gradient-to-br from-accent-950/50 to-surface p-widget-lg transition-colors hover:border-accent-500/50"
    >
      {hero.thumbnailUrl && (
        <div className="absolute inset-0 opacity-10 transition-opacity group-hover:opacity-15">
          <Image
            src={hero.thumbnailUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent-500/20 px-2 py-0.5 text-xs font-semibold text-accent-400 font-[family-name:var(--font-space-mono)]">
            TOP STORY
          </span>
          <span className="text-xs text-gray-500 font-[family-name:var(--font-space-mono)]">
            {hero.mentionCount} mentions &middot;{" "}
            {(hero.velocity ?? 0).toFixed(1)}/hr
          </span>
          {stale && (
            <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400 font-[family-name:var(--font-space-mono)]">
              outdated
            </span>
          )}
        </div>
        <h3 className="mt-3 text-lg font-bold leading-snug text-foreground">
          {hero.headline}
        </h3>
        <div className="mt-3 flex items-center gap-2">
          {hero.sources.map((source) => (
            <PlatformBadge key={source} platform={source} />
          ))}
        </div>
      </div>
    </Wrapper>
  );
}
