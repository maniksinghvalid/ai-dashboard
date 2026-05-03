import type { Video, RedditPost, Tweet, TrendingTopic } from "@/lib/types";
import { CACHE_KEYS } from "@/lib/constants";
import { cacheSet } from "@/lib/cache/helpers";

const AI_TERMS = [
  "GPT-4", "GPT-5", "Claude", "Gemini", "Llama", "Mistral", "Anthropic", "OpenAI", "Google DeepMind",
  "AGI", "ASI", "open source", "fine-tuning", "RAG", "transformer", "diffusion", "multimodal",
  "reasoning", "chain of thought", "RLHF", "DPO", "benchmark", "MMLU", "context window",
  "agent", "agentic", "tool use", "MCP", "function calling", "vision", "video generation",
  "Sora", "Midjourney", "Stable Diffusion", "DALL-E", "text-to-speech", "speech-to-text",
  "tokenizer", "embedding", "vector database", "inference", "quantization", "LoRA",
  "neural network", "deep learning", "machine learning", "reinforcement learning",
  "robotics", "autonomous", "self-driving", "regulation", "safety", "alignment",
];

interface TextItem {
  text: string;
  source: "youtube" | "reddit" | "twitter";
  timestamp: number;
}

function extractTextItems(
  videos: Video[],
  posts: RedditPost[],
  tweets: Tweet[],
): TextItem[] {
  const items: TextItem[] = [];

  for (const v of videos) {
    items.push({
      text: v.title,
      source: "youtube",
      timestamp: new Date(v.publishedAt).getTime(),
    });
  }

  for (const p of posts) {
    items.push({
      text: p.title,
      source: "reddit",
      timestamp: new Date(p.createdAt).getTime(),
    });
  }

  for (const t of tweets) {
    items.push({
      text: t.text,
      source: "twitter",
      timestamp: new Date(t.createdAt).getTime(),
    });
  }

  return items;
}

export function calculateTrending(
  videos: Video[],
  posts: RedditPost[],
  tweets: Tweet[],
): TrendingTopic[] {
  const items = extractTextItems(videos, posts, tweets);

  if (items.length === 0) {
    return [];
  }

  let minTs = Infinity;
  let maxTs = -Infinity;
  for (const item of items) {
    if (item.timestamp < minTs) minTs = item.timestamp;
    if (item.timestamp > maxTs) maxTs = item.timestamp;
  }
  const timeSpanHours = Math.max((maxTs - minTs) / (1000 * 60 * 60), 1);

  const results: TrendingTopic[] = [];

  for (const term of AI_TERMS) {
    const termLower = term.toLowerCase();
    let mentionCount = 0;
    const sourcesSet = new Set<string>();

    for (const item of items) {
      if (item.text.toLowerCase().includes(termLower)) {
        mentionCount++;
        sourcesSet.add(item.source);
      }
    }

    if (mentionCount < 2 || sourcesSet.size < 1) {
      continue;
    }

    const sources = Array.from(sourcesSet);
    const velocity = mentionCount / timeSpanHours;
    const score = mentionCount * sources.length * Math.log2(velocity + 1);

    results.push({
      topic: term,
      mentionCount,
      velocity,
      sources,
      score,
    });
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, 20);
}

export async function fetchAndCacheTrending(
  videos: Video[],
  posts: RedditPost[],
  tweets: Tweet[],
): Promise<TrendingTopic[]> {
  const topics = calculateTrending(videos, posts, tweets);
  await cacheSet(CACHE_KEYS.trending, topics);
  return topics;
}
