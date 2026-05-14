import * as Sentry from "@sentry/nextjs";
import { getRedis } from "@/lib/cache/redis";
import { cacheSet } from "@/lib/cache/helpers";
import { CACHE_KEYS } from "@/lib/constants";
import type { Sentiment } from "@/lib/types";

const TOGETHER_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";
const TOGETHER_ENDPOINT = "https://api.together.xyz/v1/chat/completions";
const DEFAULT_BUDGET = 200_000;
const BATCH_LIMIT = 20;
const TIMEOUT_MS = 35_000;
const BUDGET_EXPIRE_SECONDS = 86_400 * 2; // 48h so day-boundary edge cases survive

type Label = "positive" | "neutral" | "negative";

type Prediction = { label: Label; score: number };

export function preprocessText(text: string): string {
  // Strip @-handles and URLs — they're noise for sentiment classification and
  // also keep input small (handles can be long, URLs can be huge).
  return text
    .replace(/@[A-Za-z0-9_]+/g, "@user")
    .replace(/https?:\/\/\S+/g, "http");
}

export function aggregateSentiment(predictions: Prediction[]): Sentiment {
  if (predictions.length === 0) {
    return { positive: 0, neutral: 100, negative: 0, sampleSize: 0 };
  }

  const counts: Record<Label, number> = { positive: 0, neutral: 0, negative: 0 };
  for (const p of predictions) {
    if (p.label === "positive" || p.label === "neutral" || p.label === "negative") {
      counts[p.label]++;
    }
  }

  const total = predictions.length;
  // Largest-remainder rounding so the three percentages sum to exactly 100.
  const raw: Record<Label, number> = {
    positive: (counts.positive / total) * 100,
    neutral: (counts.neutral / total) * 100,
    negative: (counts.negative / total) * 100,
  };
  const floored: Record<Label, number> = {
    positive: Math.floor(raw.positive),
    neutral: Math.floor(raw.neutral),
    negative: Math.floor(raw.negative),
  };
  let remainder = 100 - (floored.positive + floored.neutral + floored.negative);
  const order: Label[] = (["positive", "neutral", "negative"] as Label[]).sort(
    (a, b) => raw[b] - Math.floor(raw[b]) - (raw[a] - Math.floor(raw[a])),
  );
  for (const label of order) {
    if (remainder <= 0) break;
    floored[label]++;
    remainder--;
  }

  return {
    positive: floored.positive,
    neutral: floored.neutral,
    negative: floored.negative,
    sampleSize: total,
  };
}

function todayKey(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `sentiment:budget:${y}-${m}-${d}`;
}

// Atomic check-and-consume: get → compare → incrby → expire as ONE server-side
// op. The Upstash REST transport has no MULTI/EXEC, so the get→incrby gap in a
// JS-side implementation is a double-spend window — two concurrent runs could
// both pass the guard and together overshoot the budget. Lua ARGV arrive as
// strings, hence tonumber() on every numeric arg. Returns integer sentinels
// 1/0 (never a Lua boolean — that coerces to JS null).
const CONSUME_BUDGET_SCRIPT = `
local current = tonumber(redis.call("get", KEYS[1]) or "0")
local needed = tonumber(ARGV[1])
local budget = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
if current + needed > budget then return 0 end
redis.call("incrby", KEYS[1], needed)
redis.call("expire", KEYS[1], ttl)
return 1
`;

export async function checkAndConsumeBudget(charsNeeded: number): Promise<boolean> {
  const budget = Number(process.env.SENTIMENT_DAILY_CHAR_BUDGET ?? String(DEFAULT_BUDGET));
  const key = todayKey();
  const redis = getRedis();
  const result = await redis.eval(
    CONSUME_BUDGET_SCRIPT,
    [key],
    [charsNeeded, budget, BUDGET_EXPIRE_SECONDS],
  );
  return result === 1;
}

function parseTogetherClassificationResponse(json: unknown): Prediction[] {
  // Together's chat-completions response shape — we ask the model to emit JSON
  // and parse the labelled scores. Defensive: if the response shape doesn't match,
  // treat as zero predictions rather than throwing.
  if (!json || typeof json !== "object") return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choices = (json as any).choices;
  if (!Array.isArray(choices) || choices.length === 0) return [];

  const content = choices[0]?.message?.content;
  if (typeof content !== "string") return [];

  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p: unknown): p is Prediction =>
          typeof p === "object" &&
          p !== null &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((p as any).label === "positive" ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (p as any).label === "neutral" ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (p as any).label === "negative"),
      )
      .map((p) => ({ label: p.label, score: p.score ?? 1 }));
  } catch {
    return [];
  }
}

export async function fetchAndCacheSentiment(
  items: Array<{ text: string }>,
): Promise<Sentiment> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    throw new Error("[sentiment] TOGETHER_API_KEY not set");
  }

  // BATCH_LIMIT bounds Together latency to fit the cron's maxDuration; we take
  // the first N rather than sampling because upstream feeds already arrive in
  // recency order — newest items dominate the signal.
  const preprocessed = items
    .map((i) => preprocessText(i.text))
    .filter((t) => t.length > 0)
    .slice(0, BATCH_LIMIT);

  if (preprocessed.length === 0) {
    const empty = aggregateSentiment([]);
    await cacheSet(CACHE_KEYS.sentiment, empty);
    return empty;
  }

  const totalChars = preprocessed.reduce((s, t) => s + t.length, 0);
  if (!(await checkAndConsumeBudget(totalChars))) {
    throw new Error("[sentiment] daily char budget tripped");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(TOGETHER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TOGETHER_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You classify the sentiment of each input string as one of: positive, neutral, negative. Respond with a JSON array of objects {label, score}, one per input, in the same order. No prose.",
          },
          {
            role: "user",
            content: JSON.stringify(preprocessed),
          },
        ],
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (res.status === 401) {
      // CON-key-rotation-observability: surface 401s with a distinct tag so a
      // rotated/expired TOGETHER_API_KEY shows up in Sentry as something other
      // than a generic "Together AI request failed" — the cron's outer catch
      // would otherwise lose this signal.
      console.error(
        "[sentiment] 401 from Together AI — TOGETHER_API_KEY may be expired or rotated",
      );
      if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
        Sentry.captureException(
          new Error(
            "[sentiment] Together AI 401 — TOGETHER_API_KEY may be expired or rotated",
          ),
          { tags: { component: "sentiment", reason: "key-rotation-suspected" } },
        );
      }
      throw new Error(
        "[sentiment] Together AI 401 — TOGETHER_API_KEY may be expired or rotated",
      );
    }

    if (!res.ok) {
      throw new Error(
        `[sentiment] Together AI returned ${res.status} ${res.statusText}`,
      );
    }

    const json = await res.json();
    const predictions = parseTogetherClassificationResponse(json);
    const sentiment = aggregateSentiment(predictions);
    await cacheSet(CACHE_KEYS.sentiment, sentiment);
    return sentiment;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`[sentiment] Together AI timed out after ${TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
