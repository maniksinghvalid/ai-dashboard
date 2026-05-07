import type { RedditPost } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
import { RelativeTime } from "@/components/ui/RelativeTime";

function formatScore(score: number): string {
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}k`;
  return score.toString();
}

function PostRow({ post }: { post: RedditPost }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
    >
      <div className="flex w-10 shrink-0 flex-col items-center pt-0.5">
        <svg
          className="h-3 w-3 text-platform-reddit"
          viewBox="0 0 12 8"
          fill="currentColor"
        >
          <path d="M6 0L0 8h12z" />
        </svg>
        <span className="mt-0.5 text-xs font-bold font-[family-name:var(--font-space-mono)] text-foreground">
          {formatScore(post.score)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-foreground">
          {post.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="rounded bg-platform-reddit/20 px-1.5 py-0.5 text-platform-reddit font-[family-name:var(--font-space-mono)]">
            r/{post.subreddit}
          </span>
          {post.flair && (
            <span className="rounded bg-accent-500/20 px-1.5 py-0.5 text-accent-400">
              {post.flair}
            </span>
          )}
          <span className="font-[family-name:var(--font-space-mono)]">
            {post.numComments} comments
          </span>
          <RelativeTime date={post.createdAt} />
        </div>
      </div>
    </a>
  );
}

export function RedditWidget({
  posts,
  stale,
  isLoading,
  error,
}: {
  posts: RedditPost[] | null;
  stale: boolean;
  isLoading: boolean;
  error: Error | null;
}) {
  return (
    <WidgetCard title="Reddit" stale={stale}>
      {isLoading ? (
        <WidgetSkeleton lines={5} />
      ) : error ? (
        <p className="py-6 text-center text-sm text-gray-500">
          Failed to load — retrying...
        </p>
      ) : !posts || posts.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No posts available
        </p>
      ) : (
        <div className="space-y-1">
          {posts.slice(0, 8).map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
