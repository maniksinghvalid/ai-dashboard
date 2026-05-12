import type { ReactNode } from "react";

export function WidgetCard({
  icon,
  iconBg,
  title,
  badge,
  stale = false,
  children,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  badge?: string;
  stale?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[--border] bg-surface">
      <div className="flex items-center justify-between border-b border-[--border] px-3.5 py-2.5">
        <div className="flex items-center gap-[7px] font-[family-name:var(--font-space-mono)] text-[11px] font-bold uppercase tracking-[1px] text-muted">
          <div
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-[9px] font-black text-white"
            style={{ background: iconBg }}
          >
            {icon}
          </div>
          {title}
        </div>
        <div className="flex items-center gap-2">
          {stale && (
            <span className="rounded-full bg-[rgba(255,184,48,0.12)] px-2 py-0.5 font-[family-name:var(--font-space-mono)] text-[10px] text-amber">
              outdated
            </span>
          )}
          {badge && (
            <span className="rounded-full bg-[rgba(124,110,255,0.12)] px-2 py-0.5 font-[family-name:var(--font-space-mono)] text-[10px] text-accent-secondary">
              {badge}
            </span>
          )}
        </div>
      </div>
      <div className="px-3.5 py-2.5">{children}</div>
    </div>
  );
}
