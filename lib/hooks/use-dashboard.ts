"use client";

import { useApiData } from "@/lib/hooks/use-api-data";
import type {
  Video,
  RedditPost,
  Tweet,
  NewsItem,
  TrendingTopic,
} from "@/lib/types";

export function useDashboard() {
  const youtube = useApiData<Video[]>("/api/youtube");
  const reddit = useApiData<RedditPost[]>("/api/reddit");
  const twitter = useApiData<Tweet[]>("/api/x");
  const news = useApiData<NewsItem[]>("/api/news");
  const trending = useApiData<TrendingTopic[]>("/api/trending");

  return { youtube, reddit, twitter, news, trending };
}
