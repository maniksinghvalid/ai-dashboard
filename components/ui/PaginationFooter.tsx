interface PaginationFooterProps {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  rangeLabel: string;
  hidden: boolean;
}

export function PaginationFooter({
  page,
  totalPages,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  rangeLabel,
  hidden,
}: PaginationFooterProps) {
  if (hidden) return null;

  const buttonBase =
    "rounded-[6px] border px-2 py-0.5 font-[family-name:var(--font-space-mono)] text-[10px] uppercase tracking-[0.5px] transition-colors active:scale-95";
  const buttonEnabled =
    "border-[--border] text-muted hover:border-accent hover:text-accent-secondary";
  const buttonDisabled = "border-[--border] text-muted opacity-30 cursor-not-allowed";

  return (
    <div className="flex items-center justify-between border-t border-[--border] bg-surface px-3.5 py-2 text-[10px]">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Previous page"
          className={`${buttonBase} ${hasPrev ? buttonEnabled : buttonDisabled}`}
        >
          ‹ Prev
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next page"
          className={`${buttonBase} ${hasNext ? buttonEnabled : buttonDisabled}`}
        >
          Next ›
        </button>
      </div>
      <div
        aria-live="polite"
        className="font-[family-name:var(--font-space-mono)] text-[10px] text-muted"
      >
        Page {page} of {totalPages}
      </div>
      <div className="font-[family-name:var(--font-space-mono)] text-[10px] text-muted">
        {rangeLabel}
      </div>
    </div>
  );
}
