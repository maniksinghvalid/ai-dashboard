import type { Video, NewsItem, TrendingTopic, HeroStory } from "@/lib/types";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";

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

function formatMentions(count: number): string {
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}

const SOURCE_CONFIG: Record<string, { color: string; label: string }> = {
  youtube: { color: "var(--yt)", label: "YT videos" },
  twitter: { color: "#e7e7f0", label: "posts" },
  reddit: { color: "var(--reddit)", label: "upvotes" },
};

export function HeroStoryCard({
  topics,
  videos,
  news,
  isLoading,
  stale = false,
  apiHero = null,
}: {
  topics: TrendingTopic[] | null;
  videos: Video[] | null;
  news: NewsItem[] | null;
  isLoading: boolean;
  stale?: boolean;
  apiHero?: HeroStory | null;
}) {
  // Hero-card flicker policy: prefer API hero; else fall back to client-derived
  // hero (never blank during a fetch when fallback data exists).
  const hero: HeroStory | null =
    apiHero ?? deriveHeroStory(topics, videos, news);

  if (!hero && isLoading) {
    return (
      <div className="rounded-[14px] border border-[rgba(124,110,255,0.2)] bg-gradient-to-br from-[#0f0f26] via-[#1a1040] to-[#0f1a26] p-5">
        <WidgetSkeleton lines={3} />
      </div>
    );
  }

  if (!hero) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-[14px] border border-[--border] bg-surface p-5">
        <p className="text-[11px] text-muted">No trending stories</p>
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
      className="group relative block overflow-hidden rounded-[14px] border border-[rgba(124,110,255,0.2)] bg-gradient-to-br from-[#0f0f26] via-[#1a1040] to-[#0f1a26] p-5"
    >
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-[60px] -top-[60px] h-[250px] w-[250px] bg-[radial-gradient(circle,rgba(192,132,252,0.12),transparent_70%)]" />

      <div className="relative">
        {/* Eyebrow */}
        <div className="mb-2.5 flex items-center gap-1.5 font-[family-name:var(--font-space-mono)] text-[10px] font-bold uppercase tracking-[1.5px] text-accent-secondary">
          Top Story Right Now
        </div>

        {/* Title */}
        <h3 className="mb-2.5 text-[19px] font-extrabold leading-[1.25] tracking-[-0.4px] text-white">
          {hero.headline}
        </h3>

        {/* Body text */}
        <p className="mb-3.5 text-xs leading-[1.65] text-[#8884a8]">
          {hero.mentionCount > 0
            ? `Trending across ${hero.sources.length} platforms with ${formatMentions(hero.mentionCount)} mentions and growing at ${hero.velocity.toFixed(1)}/hr.`
            : ""}
        </p>

        {/* Tags */}
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-[rgba(124,110,255,0.2)] bg-[rgba(124,110,255,0.1)] px-[9px] py-[3px] text-[10px] font-semibold text-accent-secondary">
            #{hero.topic}
          </span>
          {stale && (
            <span className="rounded-full bg-[rgba(255,184,48,0.12)] px-[9px] py-[3px] text-[10px] text-amber">
              outdated
            </span>
          )}
        </div>

        {/* Source pills */}
        <div className="flex flex-wrap gap-2">
          {hero.sources.map((source) => {
            const cfg = SOURCE_CONFIG[source] ?? {
              color: "var(--accent2)",
              label: source,
            };
            return (
              <div
                key={source}
                className="flex items-center gap-[5px] rounded-[6px] border border-[--border] bg-[rgba(255,255,255,0.04)] px-2.5 py-[5px] font-[family-name:var(--font-space-mono)] text-[10px] text-muted"
              >
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: cfg.color }}
                />
                {cfg.label}
              </div>
            );
          })}
        </div>
      </div>
    </Wrapper>
  );
}
