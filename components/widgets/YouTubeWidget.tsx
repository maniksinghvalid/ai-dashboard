import Image from "next/image";
import type { Video } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";

function formatViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
  return count.toString();
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function VideoItem({ video }: { video: Video }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex cursor-pointer gap-2.5 rounded-[6px] border-b border-[rgba(255,255,255,0.03)] py-[9px] transition-colors last:border-b-0 hover:bg-white/[0.02]"
    >
      <div className="relative flex h-[44px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[--border] bg-surface-2 text-xl">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            fill
            sizes="76px"
            className="object-cover"
          />
        ) : null}
        <div className="absolute flex h-5 w-5 items-center justify-center rounded bg-[rgba(255,51,51,0.85)] text-[8px] text-white">
          ▶
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[11px] font-semibold leading-[1.35] text-[--text]">
          {video.title}
        </div>
        <div className="mt-1 text-[10px] text-muted">
          <span className="font-semibold text-accent">{video.channelName}</span>
          {" · "}
          {formatViewCount(video.viewCount)} views · {formatRelativeTime(video.publishedAt)}
        </div>
      </div>
    </a>
  );
}

export function YouTubeWidget({
  videos,
  stale,
  isLoading,
  error,
}: {
  videos: Video[] | null;
  stale: boolean;
  isLoading: boolean;
  error: Error | null;
}) {
  const count = videos?.length ?? 0;

  return (
    <WidgetCard
      icon="▶"
      iconBg="var(--yt)"
      title="YouTube"
      badge={count > 0 ? `${count} new` : undefined}
      stale={stale}
    >
      {isLoading ? (
        <WidgetSkeleton lines={4} />
      ) : error ? (
        <p className="py-6 text-center text-[11px] text-muted">
          Failed to load — retrying...
        </p>
      ) : !videos || videos.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-muted">
          No videos available
        </p>
      ) : (
        <div>
          {videos.slice(0, 4).map((video) => (
            <VideoItem key={video.id} video={video} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
