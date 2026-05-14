export interface Video {
  id: string;
  title: string;
  channelName: string;
  channelId: string;
  thumbnailUrl: string;
  viewCount: number;
  publishedAt: string;
  viewVelocity: number;
  url: string;
}

export interface RedditPost {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  url: string;
  createdAt: string;
}

export interface Tweet {
  id: string;
  text: string;
  authorName: string;
  authorHandle: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  url: string;
}

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  summary: string;
}

export interface TrendingTopic {
  topic: string;
  mentionCount: number;
  velocity: number;
  sources: string[];
  score: number;
}

export interface HeroStory extends TrendingTopic {
  headline: string;
  thumbnailUrl: string | null;
  link: string | null;
}

export interface Sentiment {
  positive: number;
  neutral: number;
  negative: number;
  sampleSize: number;
}

export interface SpikeAlert {
  topic: string;
  velocity: number;
  baseline: number;
  multiplier: number;
  detectedAt: string;
}

export interface CachedData<T> {
  data: T;
  fetchedAt: string;
}

export interface ApiResponse<T> {
  data: T;
  cachedAt: string | null;
  stale: boolean;
}
