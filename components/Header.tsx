export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-foreground">AI Pulse</h1>
        <span className="flex items-center gap-1.5 rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-semibold text-green-400 font-[family-name:var(--font-space-mono)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-live-pulse motion-reduce:animate-none rounded-full bg-green-400" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          LIVE
        </span>
      </div>
    </header>
  );
}
