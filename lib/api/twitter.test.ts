import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchTweets } from "./twitter";
import { TWITTER_USERS } from "@/lib/constants";

// Stub cacheSet so tests don't hit Redis. ./twitter itself is NOT mocked — we
// exercise its real fetch → batch → retry → parse pipeline against a mocked
// global.fetch.
vi.mock("@/lib/cache/helpers", () => ({
  cacheSet: vi.fn().mockResolvedValue(true),
}));

// Minimal X API v2 user-timeline success body.
function xResponse(userId: string, tweetCount = 1): Response {
  const data = Array.from({ length: tweetCount }, (_, i) => ({
    id: `${userId}_t${i}`,
    text: `tweet ${i} from ${userId}`,
    created_at: "2026-05-14T10:00:00.000Z",
    author_id: userId,
    public_metrics: { like_count: 1, retweet_count: 0, reply_count: 0 },
  }));
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ data, includes: { users: [] } }),
  } as Response;
}

function statusResponse(status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({}),
  } as Response;
}

function userIdFromUrl(url: string): string {
  return url.match(/users\/(\d+)\/tweets/)?.[1] ?? "0";
}

describe("fetchTweets", () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.X_BEARER_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.X_BEARER_TOKEN = "test-token";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.X_BEARER_TOKEN = originalToken;
  });

  it("returns [] immediately when X_BEARER_TOKEN is not set", async () => {
    delete process.env.X_BEARER_TOKEN;
    global.fetch = vi.fn();

    const tweets = await fetchTweets();

    expect(tweets).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches every curated user across sequential batches", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(async (url: string) =>
        xResponse(userIdFromUrl(url)),
      );

    const tweets = await fetchTweets();

    expect(global.fetch).toHaveBeenCalledTimes(TWITTER_USERS.length);
    expect(tweets.length).toBe(TWITTER_USERS.length);
  });

  it("retries once on 429 and succeeds on the second attempt", async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let firstSeen = false;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (!firstSeen) {
        firstSeen = true;
        return statusResponse(429, "Too Many Requests");
      }
      return xResponse(userIdFromUrl(url));
    });

    const promise = fetchTweets();
    await vi.advanceTimersByTimeAsync(5000);
    const tweets = await promise;

    // every user fetched once + one retry for the 429'd user
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      TWITTER_USERS.length + 1,
    );
    expect(tweets.length).toBe(TWITTER_USERS.length);

    vi.useRealTimers();
    warnSpy.mockRestore();
  });

  it("isolates a persistent non-retryable failure for one user", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failingId = TWITTER_USERS[0].userId;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const userId = userIdFromUrl(url);
      // 401 is not in RETRY_STATUS — returns [] for that user, no retry
      if (userId === failingId) return statusResponse(401, "Unauthorized");
      return xResponse(userId);
    });

    const tweets = await fetchTweets();

    expect(tweets.length).toBe(TWITTER_USERS.length - 1);
    expect(global.fetch).toHaveBeenCalledTimes(TWITTER_USERS.length);
    warnSpy.mockRestore();
  });

  it("treats an unexpected response shape as zero tweets for that user", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    global.fetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({}),
      } as Response);

    const tweets = await fetchTweets();

    expect(tweets).toEqual([]);
    warnSpy.mockRestore();
  });
});
