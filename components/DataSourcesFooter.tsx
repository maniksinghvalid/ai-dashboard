const DATA_SOURCES = [
  { color: "var(--yt)", label: "YouTube Data API v3" },
  { color: "var(--reddit)", label: "Reddit RSS Atom Feed" },
  { color: "#e7e7f0", label: "X API Basic" },
  { color: "#0ea5e9", label: "RSS News Feeds" },
];

export function DataSourcesFooter() {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 pb-5">
      <div className="flex flex-wrap items-center gap-[18px]">
        <span className="font-[family-name:var(--font-space-mono)] text-[10px] uppercase tracking-[1px] text-[#3a3855]">
          Data Sources
        </span>
        {DATA_SOURCES.map((source) => (
          <span
            key={source.label}
            className="flex items-center gap-[5px] text-[10px] text-[#5a5475]"
          >
            <span
              className="inline-block h-[7px] w-[7px] rounded-full"
              style={{ background: source.color }}
            />
            {source.label}
          </span>
        ))}
      </div>
      <span className="font-[family-name:var(--font-space-mono)] text-[10px] text-[#3a3855]">
        Cache: Upstash Redis · Refresh: 15min · Deploy: Vercel
      </span>
    </div>
  );
}
