import type { NewsItem } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SOURCE_STYLES: Record<string, { bg: string; color: string; abbr: string }> = {
  "MIT Tech Review AI": { bg: "rgba(239,68,68,0.12)", color: "#ef4444", abbr: "MIT" },
  "TechCrunch": { bg: "rgba(34,211,165,0.12)", color: "var(--green)", abbr: "TC" },
  "Bloomberg": { bg: "rgba(14,165,233,0.12)", color: "#0ea5e9", abbr: "BB" },
  "Washington Post": { bg: "rgba(255,184,48,0.12)", color: "var(--amber)", abbr: "WP" },
  "VentureBeat": { bg: "rgba(124,110,255,0.12)", color: "var(--accent2)", abbr: "VB" },
  "The Verge AI": { bg: "rgba(168,85,247,0.12)", color: "#a855f7", abbr: "VG" },
  "ArXiv cs.AI": { bg: "rgba(14,165,233,0.12)", color: "#0ea5e9", abbr: "AX" },
};

function getSourceStyle(source: string) {
  return (
    SOURCE_STYLES[source] ?? {
      bg: "rgba(124,110,255,0.12)",
      color: "var(--accent2)",
      abbr: source.slice(0, 2).toUpperCase(),
    }
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  const style = getSourceStyle(item.source);

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex cursor-pointer items-start gap-[9px] border-b border-[rgba(255,255,255,0.03)] py-[9px] last:border-b-0"
    >
      <span
        className="mt-0.5 shrink-0 rounded-[3px] px-[5px] py-[2px] font-[family-name:var(--font-space-mono)] text-[9px] font-bold"
        style={{ background: style.bg, color: style.color }}
      >
        {style.abbr}
      </span>
      <div>
        <div className="text-[11px] font-medium leading-[1.4] text-[--text]">
          {item.title}
        </div>
        <div className="mt-0.5 text-[10px] text-muted">
          {formatRelativeTime(item.publishedAt)}
        </div>
      </div>
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
  const count = items?.length ?? 0;

  return (
    <WidgetCard
      icon="📰"
      iconBg="#0ea5e9"
      title="AI News"
      badge={count > 0 ? `${count} new` : undefined}
      stale={stale}
    >
      {isLoading ? (
        <WidgetSkeleton lines={5} />
      ) : error ? (
        <p className="py-6 text-center text-[11px] text-muted">
          Failed to load — retrying...
        </p>
      ) : !items || items.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-muted">
          No news available
        </p>
      ) : (
        <div>
          {items.slice(0, 5).map((item, i) => (
            <NewsRow key={`${item.link}-${i}`} item={item} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
