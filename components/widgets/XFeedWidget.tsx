import type { Tweet } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6366f1, #a855f7)",
  "linear-gradient(135deg, #0ea5e9, #6366f1)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #22d3a5, #0ea5e9)",
  "linear-gradient(135deg, #ec4899, #8b5cf6)",
  "linear-gradient(135deg, #14b8a6, #3b82f6)",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function TweetCard({ tweet, index }: { tweet: Tweet; index: number }) {
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];

  return (
    <a
      href={tweet.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block cursor-pointer border-b border-[rgba(255,255,255,0.03)] py-2.5 last:border-b-0"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
          style={{ background: gradient }}
        >
          {getInitials(tweet.authorName)}
        </div>
        <div>
          <span className="text-xs font-bold text-[--text]">
            {tweet.authorName}
            <span className="ml-0.5 text-[11px] text-[#3b82f6]">✓</span>
          </span>
          <div className="text-[10px] text-muted">@{tweet.authorHandle}</div>
        </div>
      </div>
      <div className="mb-1.5 text-[11px] leading-[1.55] text-[#9994b8]">
        {tweet.text}
      </div>
      <div className="flex gap-3.5">
        <span className="font-[family-name:var(--font-space-mono)] text-[10px] text-muted">
          ❤ {formatCount(tweet.likeCount)}
        </span>
        <span className="font-[family-name:var(--font-space-mono)] text-[10px] text-muted">
          🔁 {formatCount(tweet.retweetCount)}
        </span>
      </div>
    </a>
  );
}

export function XFeedWidget({
  tweets,
  stale,
  isLoading,
  error,
}: {
  tweets: Tweet[] | null;
  stale: boolean;
  isLoading: boolean;
  error: Error | null;
}) {
  return (
    <WidgetCard
      icon={<span className="text-[11px] font-black text-platform-x">𝕏</span>}
      iconBg="#111"
      title="X / Twitter"
      badge="Live feed"
      stale={stale}
    >
      {isLoading ? (
        <WidgetSkeleton lines={4} />
      ) : error ? (
        <p className="py-6 text-center text-[11px] text-muted">
          Failed to load — retrying...
        </p>
      ) : !tweets || tweets.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-muted">
          No tweets available
        </p>
      ) : (
        <div>
          {tweets.slice(0, 4).map((tweet, i) => (
            <TweetCard key={tweet.id} tweet={tweet} index={i} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
