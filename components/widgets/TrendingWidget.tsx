import type { TrendingTopic } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
import { PlatformBadge } from "@/components/ui/PlatformBadge";

function TopicChip({
  topic,
  rank,
  maxMentions,
}: {
  topic: TrendingTopic;
  rank: number;
  maxMentions: number;
}) {
  const barWidth =
    maxMentions > 0 ? (topic.mentionCount / maxMentions) * 100 : 0;

  return (
    <div className="rounded-lg bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 font-[family-name:var(--font-space-mono)]">
            #{rank}
          </span>
          <span className="text-sm font-medium text-foreground">
            {topic.topic}
          </span>
        </div>
        <span className="text-xs text-gray-500 font-[family-name:var(--font-space-mono)]">
          {topic.mentionCount} mentions
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-accent-500 transition-all duration-500"
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {topic.sources.map((source) => (
          <PlatformBadge key={source} platform={source} />
        ))}
        <span className="ml-auto text-[10px] text-gray-500 font-[family-name:var(--font-space-mono)]">
          {topic.velocity.toFixed(1)}/hr
        </span>
      </div>
    </div>
  );
}

export function TrendingWidget({
  topics,
  stale,
  isLoading,
  error,
}: {
  topics: TrendingTopic[] | null;
  stale: boolean;
  isLoading: boolean;
  error: Error | null;
}) {
  const maxMentions = topics?.[0]?.mentionCount ?? 0;

  return (
    <WidgetCard title="Trending Topics" stale={stale}>
      {isLoading ? (
        <WidgetSkeleton lines={5} />
      ) : error ? (
        <p className="py-6 text-center text-sm text-gray-500">
          Failed to load — retrying...
        </p>
      ) : !topics || topics.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No trending topics
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {topics.slice(0, 8).map((topic, i) => (
            <TopicChip
              key={topic.topic}
              topic={topic}
              rank={i + 1}
              maxMentions={maxMentions}
            />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
