import type { TrendingTopic } from "@/lib/types";

export function LiveTicker({ topics }: { topics: TrendingTopic[] | null }) {
  if (!topics || topics.length === 0) return null;

  const items = topics.slice(0, 10);
  const tickerContent = [...items, ...items];

  return (
    <div className="overflow-hidden border-b border-white/5 bg-surface-dark py-2">
      {/* Accessible static summary for screen readers */}
      <p className="sr-only">
        Trending: {items.map((t) => t.topic).join(", ")}
      </p>
      <div
        aria-hidden="true"
        className="animate-ticker-scroll flex whitespace-nowrap motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:gap-4"
        style={{ willChange: "transform" }}
      >
        {tickerContent.map((topic, i) => (
          <span
            key={`${topic.topic}-${i}`}
            className="mx-4 inline-flex items-center gap-2 text-xs"
          >
            <span className="font-medium text-foreground">{topic.topic}</span>
            <span className="text-accent-400 font-[family-name:var(--font-space-mono)]">
              {topic.mentionCount} mentions
            </span>
            <span className="text-green-400 font-[family-name:var(--font-space-mono)]">
              +{(topic.velocity ?? 0).toFixed(1)}/hr
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
