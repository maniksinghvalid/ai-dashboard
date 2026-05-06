"use client";

import { useState } from "react";

const FILTERS = ["All", "Models", "Research", "Products"] as const;

export function Header() {
  const [activeFilter, setActiveFilter] = useState<string>("All");

  return (
    <header className="sticky top-0 z-[100] flex h-[52px] items-center justify-between border-b border-[--border] bg-[rgba(6,6,16,0.85)] px-6 backdrop-blur-[18px]">
      <div className="flex items-center gap-[10px]">
        {/* Logo mark */}
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-secondary font-[family-name:var(--font-space-mono)] text-[11px] font-bold text-white shadow-[0_0_16px_rgba(124,110,255,0.4)]">
          AI
        </div>
        {/* Logo text */}
        <span className="text-[15px] font-extrabold tracking-[-0.5px] text-[--text]">
          AI<span className="text-accent-secondary">Pulse</span>
        </span>
        {/* Live pill */}
        <div className="flex items-center gap-1.5 rounded-full border border-[rgba(34,211,165,0.2)] bg-[rgba(34,211,165,0.08)] px-[10px] py-[3px] font-[family-name:var(--font-space-mono)] text-[10px] font-bold tracking-[1px] text-green">
          <span className="h-1.5 w-1.5 animate-live-blink rounded-full bg-green" />
          LIVE
        </div>
      </div>

      <div className="flex items-center gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`rounded-md border px-3 py-1 font-[family-name:var(--font-dm-sans)] text-[11px] font-semibold transition-all ${
              activeFilter === filter
                ? "border-accent bg-[rgba(124,110,255,0.08)] text-accent-secondary"
                : "border-[--border] text-muted hover:border-accent hover:bg-[rgba(124,110,255,0.08)] hover:text-accent-secondary"
            }`}
          >
            {filter}
          </button>
        ))}
        <button className="rounded-md border border-[--border] px-3 py-1 text-[11px] text-muted transition-all hover:border-accent hover:text-accent-secondary">
          ⚙
        </button>
      </div>
    </header>
  );
}
