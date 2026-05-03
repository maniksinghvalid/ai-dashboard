export const YOUTUBE_CHANNELS = [
  { name: "Andrej Karpathy", channelId: "UCXUPKJO5MZQN11PqgIvyuvQ", uploadsPlaylistId: "UUXUPKJO5MZQN11PqgIvyuvQ" },
  { name: "Lex Fridman", channelId: "UCSHZKyawb77ixDdsGog4iWA", uploadsPlaylistId: "UUSHZKyawb77ixDdsGog4iWA" },
  { name: "Two Minute Papers", channelId: "UCbfYPyITQ-7l4upoX8nvctg", uploadsPlaylistId: "UUbfYPyITQ-7l4upoX8nvctg" },
  { name: "AI Explained", channelId: "UCNJ1Ymd5yFuUPtn21xtRbbw", uploadsPlaylistId: "UUNJ1Ymd5yFuUPtn21xtRbbw" },
  { name: "Yannic Kilcher", channelId: "UCZHmQk67mSJgfCCTn7xBfew", uploadsPlaylistId: "UUZHmQk67mSJgfCCTn7xBfew" },
  { name: "Google DeepMind", channelId: "UCP7jMXSY2xbc3KCAE0MHQ-A", uploadsPlaylistId: "UUP7jMXSY2xbc3KCAE0MHQ-A" },
  { name: "OpenAI", channelId: "UCXZCJLdBC09xxGZ6gcdrc6A", uploadsPlaylistId: "UUXZCJLdBC09xxGZ6gcdrc6A" },
  { name: "Fireship", channelId: "UCsBjURrPoezykLs9EqgamOA", uploadsPlaylistId: "UUsBjURrPoezykLs9EqgamOA" },
] as const;

export const SUBREDDITS = [
  "MachineLearning",
  "artificial",
  "LocalLLaMA",
  "ChatGPT",
  "singularity",
] as const;

export const TWITTER_USERS = [
  { handle: "sama", userId: "3108351" },
  { handle: "ylecun", userId: "50705664" },
  { handle: "karpathy", userId: "33836629" },
  { handle: "DarioAmodei", userId: "1366aborede4" },
  { handle: "fchollet", userId: "485117960" },
  { handle: "AnthropicAI", userId: "1450081635559428100" },
  { handle: "OpenAI", userId: "1511943437373345793" },
  { handle: "GoogleDeepMind", userId: "1542437028" },
] as const;

export const RSS_FEEDS = [
  { name: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { name: "MIT Tech Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
  { name: "ArXiv cs.AI", url: "https://rss.arxiv.org/rss/cs.AI" },
] as const;

export const CACHE_KEYS = {
  youtube: "yt:latest",
  reddit: "reddit:hot",
  twitter: "x:feed",
  trending: "trending:topics",
  news: "news:feed",
} as const;

export const CACHE_MAX_AGE = {
  default: 15 * 60 * 1000, // 15 minutes
  twitter: 10 * 60 * 1000, // 10 minutes
} as const;

export const APIFY_ACTOR_ID = "trudax/reddit-scraper-lite";

export const REDDIT_FLAIR_ALLOWLIST = ["Paper", "News", "Discussion"];
