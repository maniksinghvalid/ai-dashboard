import { useEffect, useRef, useState, type ReactNode } from "react";

const PAGE_FADE_MS = 120;

export function WidgetCard({
  icon,
  iconBg,
  title,
  badge,
  stale = false,
  scrollable,
  maxBodyHeight,
  footer,
  paginationKey,
  children,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  badge?: string;
  stale?: boolean;
  scrollable?: boolean;
  maxBodyHeight?: string;
  footer?: ReactNode;
  paginationKey?: number | string;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(false);
  const [paging, setPaging] = useState(false);
  // Skip the very first render so initial mount doesn't visibly flash.
  const isFirstPaginationRender = useRef(true);

  useEffect(() => {
    if (!scrollable) return;
    const el = scrollRef.current;
    if (!el) return;
    const check = () =>
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, [scrollable]);

  useEffect(() => {
    if (paginationKey === undefined) return;
    if (isFirstPaginationRender.current) {
      isFirstPaginationRender.current = false;
      return;
    }
    setPaging(true);
    const t = setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      setPaging(false);
    }, PAGE_FADE_MS);
    return () => clearTimeout(t);
  }, [paginationKey]);

  return (
    <div className="group overflow-hidden rounded-[14px] border border-[--border] bg-surface">
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
      {scrollable ? (
        <div
          ref={scrollRef}
          tabIndex={0}
          role="region"
          aria-label={`${title} feed, scrollable`}
          data-paging={paging ? "out" : "in"}
          className={`relative ${maxBodyHeight ?? "max-h-[320px]"} overflow-y-auto scrollbar-thin px-3.5 py-2.5 outline-none transition-opacity duration-[120ms] focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-inset data-[paging=out]:opacity-0`}
        >
          {children}
          {!atBottom && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-9 bg-gradient-to-t from-[var(--surface)] to-transparent"
            />
          )}
        </div>
      ) : (
        <div className="px-3.5 py-2.5">{children}</div>
      )}
      {footer}
    </div>
  );
}
