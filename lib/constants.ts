export const YOUTUBE_CHANNELS = [
  { name: "Nate Herk", channelId: "UC2ojq-nuP8ceeHqiroeKhBA", uploadsPlaylistId: "UU2ojq-nuP8ceeHqiroeKhBA" },
  { name: "Matthew Berman", channelId: "UCawZsQWqfGSbCI5yjkdVkTA", uploadsPlaylistId: "UUawZsQWqfGSbCI5yjkdVkTA" },
  { name: "Duncan Rogoff", channelId: "UC37JpWP5PxLSma2lh79HU9A", uploadsPlaylistId: "UU37JpWP5PxLSma2lh79HU9A" },
  { name: "TechWithTim", channelId: "UC4JX40jDee_tINbkjycV4Sg", uploadsPlaylistId: "UU4JX40jDee_tINbkjycV4Sg" },
  { name: "Greg Isenberg", channelId: "UCPjNBjflYl0-HQtUvOx0Ibw", uploadsPlaylistId: "UUPjNBjflYl0-HQtUvOx0Ibw" },
] as const;

// `aiFilter: true` subreddits are general-purpose, so their posts are
// keyword-filtered for AI relevance in lib/api/reddit.ts before caching.
export type SubredditConfig = { slug: string; aiFilter?: boolean };

export const SUBREDDITS = [
  { slug: "MachineLearning" },
  { slug: "LocalLLaMA" },
  { slug: "artificial" },
  { slug: "singularity" },
  { slug: "programming", aiFilter: true },
] as const satisfies readonly SubredditConfig[];

// Numeric X user IDs (the X API v2 /2/users/:id/tweets path needs IDs, not
// handles). Resolved + name-verified via api.fxtwitter.com, 2026-05-14.
export const TWITTER_USERS = [
  // Core research & pioneers
  { handle: "karpathy", userId: "33836629" },
  { handle: "fchollet", userId: "68746721" },
  { handle: "ylecun", userId: "50705664" },
  { handle: "AndrewYNg", userId: "216939636" },
  { handle: "drfeifei", userId: "130745589" },
  { handle: "demishassabis", userId: "1482581556" },
  // Implementation & engineering
  { handle: "rasbt", userId: "865622395" },
  { handle: "jeremyphoward", userId: "175282603" },
  { handle: "simonw", userId: "12497" },
  { handle: "goodside", userId: "16535432" },
  { handle: "ID_AA_Carmack", userId: "175624200" },
  // Curators & news
  { handle: "dair_ai", userId: "889050642903293953" },
  { handle: "lilianweng", userId: "96999384" },
  { handle: "_akhaliq", userId: "2465283662" },
  { handle: "gwern", userId: "17664709" },
] as const;

export const RSS_FEEDS = [
  // --- Your Original Feeds ---
  { name: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { name: "MIT Tech Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
  { name: "ArXiv cs.AI", url: "https://rss.arxiv.org/rss/cs.AI" },

  // --- Latest & Favorite Additions (2026) ---
  
  // 1. Official AI Lab Insights (Primary Sources)
  { name: "OpenAI Blog", url: "https://openai.com/news/rss.xml" },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml" },
  { name: "Anthropic News", url: "https://www.anthropic.com/news/rss.xml" },
  
  // 2. Open Source & Technical Implementation
  { name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml" },
  { name: "LlamaIndex Blog", url: "https://www.llamaindex.ai/blog/rss.xml" },
  { name: "Machine Learning Mastery", url: "https://machinelearningmastery.com/feed/" },

  // 3. Industry Analysis & Market Sentiment
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/" },
  { name: "Wired AI", url: "https://www.wired.com/feed/tag/ai/latest/rss" },
  { name: "Ars Technica AI", url: "https://arstechnica.com/ai/feed/" },

  // 4. Developer & Ethics Focused
  { name: "TLDR AI", url: "https://tldr.tech/ai/rss" },
  { name: "AI Ethics Lab", url: "https://aiethicslab.com/feed/" }
] as const;

export const CACHE_KEYS = {
  youtube: "yt:latest",
  reddit: "reddit:hot",
  twitter: "x:feed",
  trending: "trending:topics",
  news: "news:feed",
  sentiment: "sentiment:latest",
  trendingRanked: "trending:ranked",
  hero: "hero:cross-platform",
  spikes: "alerts:spikes",
  cronLock: "cron:refresh:lock",
} as const;

export const CACHE_MAX_AGE = {
  default: 15 * 60 * 1000, // 15 minutes
  twitter: 10 * 60 * 1000, // 10 minutes
  tenMin: 10 * 60 * 1000, // 10 minutes (hero, trendingRanked)
} as const;
