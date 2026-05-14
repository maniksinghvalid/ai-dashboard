import type { RedditPost } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
import { formatRelativeTime } from "@/lib/utils/format";

// Reddit data now comes from the .rss (Atom) feed, which carries no score or
// comment count — the row is built from the fields RSS actually provides:
// subreddit, title, author, timestamp.
function PostRow({ post }: { post: RedditPost }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block cursor-pointer border-b border-[rgba(255,255,255,0.03)] py-[9px] last:border-b-0"
    >
      <div className="mb-0.5 text-[10px] font-bold text-platform-reddit">
        r/{post.subreddit}
      </div>
      <div className="line-clamp-2 text-[11px] font-semibold leading-[1.35] text-[--text]">
        {post.title}
      </div>
      <div className="mt-[3px] text-[10px] text-muted">
        u/{post.author} · {formatRelativeTime(post.createdAt)}
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
          Feed temporarily unavailable
        </p>
      ) : !posts || posts.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-muted">
          No posts available
        </p>
      ) : (
        <div>
          {posts.slice(0, 3).map((post) => (
            // post.url always has a value (normalizer falls back), so it's a
            // safe key even in the unlikely event an Atom entry had no <id>.
            <PostRow key={post.id || post.url} post={post} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
