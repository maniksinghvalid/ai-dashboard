import type { RedditPost } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";

function formatScore(score: number): string {
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}k`;
  return score.toString();
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function PostRow({ post }: { post: RedditPost }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex cursor-pointer gap-2.5 border-b border-[rgba(255,255,255,0.03)] py-[9px] last:border-b-0"
    >
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <span className="text-xs text-platform-reddit">▲</span>
        <span className="font-[family-name:var(--font-space-mono)] text-[10px] font-bold text-platform-reddit">
          {formatScore(post.score)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-[10px] font-bold text-platform-reddit">
          r/{post.subreddit}
        </div>
        <div className="line-clamp-2 text-[11px] font-semibold leading-[1.35] text-[--text]">
          {post.title}
        </div>
        <div className="mt-[3px] text-[10px] text-muted">
          {post.numComments} comments · {formatRelativeTime(post.createdAt)}
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
    <WidgetCard
      icon="●"
      iconBg="var(--reddit)"
      title="Reddit"
      badge="r/ML · r/AI"
      stale={stale}
    >
      {isLoading ? (
        <WidgetSkeleton lines={3} />
      ) : error ? (
        <p className="py-6 text-center text-[11px] text-muted">
          Failed to load — retrying...
        </p>
      ) : !posts || posts.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-muted">
          No posts available
        </p>
      ) : (
        <div>
          {posts.slice(0, 3).map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
