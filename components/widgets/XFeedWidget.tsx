import type { Tweet } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
import { RelativeTime } from "@/components/ui/RelativeTime";

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function AuthorAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-light text-xs font-bold text-gray-400">
      {initials}
    </div>
  );
}

function TweetCard({ tweet }: { tweet: Tweet }) {
  return (
    <a
      href={tweet.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
    >
      <AuthorAvatar name={tweet.authorName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">
            {tweet.authorName}
          </span>
          <span className="truncate text-xs text-gray-500">
            @{tweet.authorHandle}
          </span>
          <span className="text-gray-600">&middot;</span>
          <RelativeTime date={tweet.createdAt} />
        </div>
        <p className="mt-1 line-clamp-3 text-sm text-gray-300">
          {tweet.text}
        </p>
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 font-[family-name:var(--font-space-mono)]">
          <span className="flex items-center gap-1">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
            {formatCount(tweet.likeCount)}
          </span>
          <span className="flex items-center gap-1">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"
              />
            </svg>
            {formatCount(tweet.retweetCount)}
          </span>
        </div>
      </div>
    </a>
  );
}

export function XFeedWidget({
  tweets,
  stale,
  isLoading,
}: {
  tweets: Tweet[] | null;
  stale: boolean;
  isLoading: boolean;
}) {
  return (
    <WidgetCard title="X / Twitter" stale={stale}>
      {isLoading ? (
        <WidgetSkeleton lines={4} />
      ) : !tweets || tweets.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No tweets available
        </p>
      ) : (
        <div className="space-y-1">
          {tweets.slice(0, 6).map((tweet) => (
            <TweetCard key={tweet.id} tweet={tweet} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
