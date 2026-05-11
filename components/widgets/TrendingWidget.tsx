import type { TrendingTopic } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";

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
    <div className="cursor-pointer rounded-[10px] border border-[--border] bg-surface-2 px-3 py-2.5 transition-colors hover:border-accent">
      <div className="mb-1 font-[family-name:var(--font-space-mono)] text-[9px] text-muted">
        #{rank} TRENDING
      </div>
      <div className="mb-1.5 text-[13px] font-bold text-[--text]">
        {topic.topic}
      </div>
      <div className="mb-[5px] h-[3px] rounded-sm bg-surface">
        <div
          className="h-[3px] rounded-sm bg-gradient-to-r from-accent to-accent-secondary transition-all duration-500"
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="font-[family-name:var(--font-space-mono)] text-[10px] font-bold text-accent-secondary">
        ↑ {topic.mentionCount.toLocaleString()} mentions
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
    <WidgetCard
      icon="↑"
      iconBg="linear-gradient(135deg, var(--accent), var(--accent2))"
      title="Trending"
      badge="Cross-platform"
      stale={stale}
    >
      {isLoading ? (
        <WidgetSkeleton lines={5} />
      ) : error ? (
        <p className="py-6 text-center text-[11px] text-muted">
          Failed to load — retrying...
        </p>
      ) : !topics || topics.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-muted">
          No trending topics
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {topics.slice(0, 6).map((topic, i) => (
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
