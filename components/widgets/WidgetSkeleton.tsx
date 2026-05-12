export function WidgetSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="flex gap-3">
          {i === 0 && (
            <div className="h-12 w-12 shrink-0 rounded-lg bg-white/5" />
          )}
          <div className="flex-1 space-y-2">
            <div
              className="h-3 rounded bg-white/5"
              style={{ width: `${70 + ((i * 17) % 30)}%` }}
            />
            <div className="h-2 w-1/2 rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
