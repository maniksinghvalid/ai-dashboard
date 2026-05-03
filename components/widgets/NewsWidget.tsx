import type { NewsItem } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
import { RelativeTime } from "@/components/ui/RelativeTime";

const SOURCE_COLORS: Record<string, string> = {
  "The Verge AI": "bg-purple-500/20 text-purple-400",
  "MIT Tech Review AI": "bg-red-500/20 text-red-400",
  "ArXiv cs.AI": "bg-blue-500/20 text-blue-400",
};

function NewsRow({ item }: { item: NewsItem }) {
  const colorClass =
    SOURCE_COLORS[item.source] ?? "bg-white/10 text-gray-400";

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-1 rounded-lg p-2 transition-colors hover:bg-white/5"
    >
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium font-[family-name:var(--font-space-mono)] ${colorClass}`}
        >
          {item.source}
        </span>
        <RelativeTime date={item.publishedAt} />
      </div>
      <p className="line-clamp-2 text-sm font-medium text-foreground">
        {item.title}
      </p>
    </a>
  );
}

export function NewsWidget({
  items,
  stale,
  isLoading,
  error,
}: {
  items: NewsItem[] | null;
  stale: boolean;
  isLoading: boolean;
  error: Error | null;
}) {
  return (
    <WidgetCard title="News" stale={stale}>
      {isLoading ? (
        <WidgetSkeleton lines={5} />
      ) : error ? (
        <p className="py-6 text-center text-sm text-gray-500">
          Failed to load — retrying...
        </p>
      ) : !items || items.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No news available
        </p>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 8).map((item, i) => (
            <NewsRow key={`${item.link}-${i}`} item={item} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
