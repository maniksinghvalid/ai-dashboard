import { google } from "googleapis";
import type { Video } from "@/lib/types";
import { YOUTUBE_CHANNELS, CACHE_KEYS } from "@/lib/constants";
import { cacheSet } from "@/lib/cache/helpers";

export async function fetchYouTubeVideos(): Promise<Video[]> {
  if (!process.env.YOUTUBE_API_KEY) {
    console.warn("[youtube] YOUTUBE_API_KEY not set, skipping fetch");
    return [];
  }

  const youtube = google.youtube({
    version: "v3",
    auth: process.env.YOUTUBE_API_KEY,
  });

  // Fetch latest uploads from each channel (allSettled so one bad channel doesn't fail all)
  const playlistResults = await Promise.allSettled(
    YOUTUBE_CHANNELS.map((channel) =>
      youtube.playlistItems.list({
        playlistId: channel.uploadsPlaylistId,
        part: ["snippet"],
        maxResults: 5,
      })
    )
  );

  // Collect all video IDs from successful responses
  const videoIds: string[] = [];
  for (const result of playlistResults) {
    if (result.status !== "fulfilled") {
      const reason = result.reason as { message?: string } | undefined;
      console.warn(
        "[youtube] playlist fetch rejected:",
        reason?.message ?? result.reason,
      );
      continue;
    }
    const items = result.value.data.items ?? [];
    for (const item of items) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (videoId) {
        videoIds.push(videoId);
      }
    }
  }

  if (videoIds.length === 0) {
    return [];
  }

  // Batch fetch video details (max 50 IDs per request)
  const batches: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    batches.push(videoIds.slice(i, i + 50));
  }

  const videoResponses = await Promise.all(
    batches.map((batch) =>
      youtube.videos.list({
        id: batch,
        part: ["snippet", "statistics"],
      })
    )
  );

  // Map to Video[]
  const videos: Video[] = [];
  for (const response of videoResponses) {
    const items = response.data.items ?? [];
    for (const item of items) {
      const id = item.id;
      const snippet = item.snippet;
      const statistics = item.statistics;

      if (!id || !snippet) continue;

      const viewCount = parseInt(statistics?.viewCount || "0", 10);
      const publishedAt = snippet.publishedAt || new Date().toISOString();
      const hoursSincePublished =
        (Date.now() - new Date(publishedAt).getTime()) / 3_600_000;
      const viewVelocity = viewCount / Math.max(hoursSincePublished, 1);

      videos.push({
        id,
        title: snippet.title || "",
        channelName: snippet.channelTitle || "",
        channelId: snippet.channelId || "",
        thumbnailUrl:
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.default?.url ||
          "",
        viewCount,
        publishedAt,
        viewVelocity,
        url: `https://www.youtube.com/watch?v=${id}`,
      });
    }
  }

  // Sort by view velocity descending
  videos.sort((a, b) => b.viewVelocity - a.viewVelocity);

  await cacheSet(CACHE_KEYS.youtube, videos);

  return videos;
}
