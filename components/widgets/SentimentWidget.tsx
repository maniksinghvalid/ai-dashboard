import type { Sentiment } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";

export function SentimentWidget({
  data,
  stale,
  isLoading,
  error,
}: {
  data: Sentiment | null;
  stale: boolean;
  isLoading: boolean;
  error: Error | null;
}) {
  const badge =
    data && data.sampleSize > 0 ? `n=${data.sampleSize}` : undefined;

  return (
    <WidgetCard
      icon="😐"
      iconBg="var(--accent)"
      title="Community Sentiment"
      badge={badge}
      stale={stale}
    >
      {isLoading ? (
        <WidgetSkeleton lines={3} />
      ) : error ? (
        <p className="py-6 text-center text-[11px] text-muted">
          Failed to load — retrying…
        </p>
      ) : !data || data.sampleSize === 0 ? (
        <p className="py-6 text-center text-[11px] text-muted">
          No sentiment data yet
        </p>
      ) : (
        <div>
          <div className="mb-2 font-[family-name:var(--font-space-mono)] text-[10px] text-muted">
            OVERALL AI SENTIMENT ANALYSIS
          </div>
          <div className="mb-2 flex h-2 overflow-hidden rounded">
            <div className="bg-green" style={{ width: `${data.positive}%` }} />
            <div className="mx-0.5 bg-amber" style={{ width: `${data.neutral}%` }} />
            <div className="bg-red" style={{ width: `${data.negative}%` }} />
          </div>
          <div className="flex gap-3.5">
            <div className="flex items-center gap-[5px] text-[10px] text-muted">
              <span className="h-[7px] w-[7px] rounded-full bg-green" />
              Positive {data.positive}%
            </div>
            <div className="flex items-center gap-[5px] text-[10px] text-muted">
              <span className="h-[7px] w-[7px] rounded-full bg-amber" />
              Neutral {data.neutral}%
            </div>
            <div className="flex items-center gap-[5px] text-[10px] text-muted">
              <span className="h-[7px] w-[7px] rounded-full bg-red" />
              Negative {data.negative}%
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
