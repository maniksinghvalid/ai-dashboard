import { WidgetCard } from "@/components/widgets/WidgetCard";

export function SentimentWidget() {
  return (
    <WidgetCard
      icon="😐"
      iconBg="var(--amber)"
      title="Community Sentiment"
      badge="Sample data"
    >
      <div>
        <div className="mb-2 font-[family-name:var(--font-space-mono)] text-[10px] text-muted">
          OVERALL AI SENTIMENT ANALYSIS
        </div>
        <div className="mb-2 flex h-2 overflow-hidden rounded">
          <div className="bg-green" style={{ width: "58%" }} />
          <div className="mx-0.5 bg-amber" style={{ width: "26%" }} />
          <div className="bg-red" style={{ width: "16%" }} />
        </div>
        <div className="flex gap-3.5">
          <div className="flex items-center gap-[5px] text-[10px] text-muted">
            <span className="h-[7px] w-[7px] rounded-full bg-green" />
            Positive 58%
          </div>
          <div className="flex items-center gap-[5px] text-[10px] text-muted">
            <span className="h-[7px] w-[7px] rounded-full bg-amber" />
            Neutral 26%
          </div>
          <div className="flex items-center gap-[5px] text-[10px] text-muted">
            <span className="h-[7px] w-[7px] rounded-full bg-red" />
            Negative 16%
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
