import type { TrendingTopic } from "@/lib/types";

function formatMentions(count: number): string {
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}k`;
  return count.toString();
}

export function LiveTicker({ topics }: { topics: TrendingTopic[] | null }) {
  if (!topics || topics.length === 0) return null;

  const items = topics.slice(0, 8);
  const tickerContent = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-b border-[--border] bg-surface py-1.5">
      {/* Accessible static summary for screen readers */}
      <p className="sr-only">
        Trending: {items.map((t) => t.topic).join(", ")}
      </p>

      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[2] w-20 bg-gradient-to-r from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-20 bg-gradient-to-l from-surface to-transparent" />

      <div
        aria-hidden="true"
        className="flex animate-ticker-scroll whitespace-nowrap motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:gap-4"
        style={{ willChange: "transform" }}
      >
        {tickerContent.map((topic, i) => (
          <span
            key={`${topic.topic}-${i}`}
            className="inline-flex items-center gap-1.5 border-r border-[--border] px-7 font-[family-name:var(--font-space-mono)] text-[11px] text-muted"
          >
            <strong className="font-bold text-[--text]">{topic.topic}</strong>
            <span className="text-green">
              ↑ {formatMentions(topic.mentionCount)} mentions
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
