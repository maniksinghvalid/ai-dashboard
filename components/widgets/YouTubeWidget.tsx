import Image from "next/image";
import type { Video } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
import { RelativeTime } from "@/components/ui/RelativeTime";

function formatViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function VelocityBadge({ velocity }: { velocity: number }) {
  if (velocity <= 0) return null;
  const label =
    velocity >= 10_000 ? "Viral" : velocity >= 1_000 ? "Trending" : "Rising";
  const color =
    velocity >= 10_000
      ? "text-red-400 bg-red-400/20"
      : velocity >= 1_000
        ? "text-accent-400 bg-accent-400/20"
        : "text-green-400 bg-green-400/20";
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium font-[family-name:var(--font-space-mono)] ${color}`}
    >
      {label}
    </span>
  );
}

function VideoCard({ video }: { video: Video }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
    >
      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-white/5">
        <Image
          src={video.thumbnailUrl}
          alt={video.title}
          fill
          sizes="112px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-foreground">
          {video.title}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
          <span className="truncate">{video.channelName}</span>
          <span>&middot;</span>
          <span className="font-[family-name:var(--font-space-mono)]">
            {formatViewCount(video.viewCount)} views
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <RelativeTime date={video.publishedAt} />
          <VelocityBadge velocity={video.viewVelocity} />
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
  return (
    <WidgetCard title="YouTube" stale={stale}>
      {isLoading ? (
        <WidgetSkeleton lines={4} />
      ) : error ? (
        <p className="py-6 text-center text-sm text-gray-500">
          Failed to load — retrying...
        </p>
      ) : !videos || videos.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No videos available
        </p>
      ) : (
        <div className="space-y-1">
          {videos.slice(0, 6).map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
