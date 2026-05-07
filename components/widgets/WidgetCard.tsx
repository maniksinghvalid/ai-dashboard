import type { ReactNode } from "react";

export function WidgetCard({
  title,
  stale = false,
  children,
}: {
  title: string;
  stale?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-widget border border-white/10 bg-surface p-widget">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-widget-title text-foreground">{title}</h2>
        {stale && (
          <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400 font-[family-name:var(--font-space-mono)]">
            outdated
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
