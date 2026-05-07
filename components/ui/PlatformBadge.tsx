const PLATFORM_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  youtube: {
    bg: "bg-platform-youtube/20",
    text: "text-platform-youtube",
    label: "YouTube",
  },
  reddit: {
    bg: "bg-platform-reddit/20",
    text: "text-platform-reddit",
    label: "Reddit",
  },
  twitter: {
    bg: "bg-platform-x/20",
    text: "text-platform-x",
    label: "X",
  },
};

export function PlatformBadge({ platform }: { platform: string }) {
  const style = PLATFORM_STYLES[platform] ?? {
    bg: "bg-white/10",
    text: "text-gray-400",
    label: platform,
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium font-[family-name:var(--font-space-mono)] ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}
