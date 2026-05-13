import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeRedditJsonPost,
  isPostKeepable,
  fetchRedditPosts,
} from "./reddit";

// Stub cacheSet so tests don't hit Redis. ./reddit itself is NOT mocked —
// we exercise its real fetch/normalize/filter pipeline against a mocked
// global.fetch (set up per-test below).
vi.mock("@/lib/cache/helpers", () => ({
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

describe("normalizeRedditJsonPost", () => {
  it("maps a self-post (Reddit-hosted) to RedditPost with the Reddit url", () => {
    const raw = {
      id: "abc123",
      title: "Sample post title",
      author: "someuser",
      subreddit: "MachineLearning",
      score: 1234,
      num_comments: 56,
      link_flair_text: "Paper",
      permalink: "/r/MachineLearning/comments/abc123/sample/",
      url: "https://www.reddit.com/r/MachineLearning/comments/abc123/sample/",
      created_utc: 1715000000,
      stickied: false,
      over_18: false,
    };

    const post = normalizeRedditJsonPost(raw);

    expect(post).toEqual({
      id: "abc123",
      title: "Sample post title",
      author: "someuser",
      subreddit: "MachineLearning",
      score: 1234,
      numComments: 56,
      flair: "Paper",
      url: "https://www.reddit.com/r/MachineLearning/comments/abc123/sample/",
      createdAt: new Date(1715000000 * 1000).toISOString(),
    });
  });

  it("maps a link-post to the external url, not the Reddit permalink", () => {
    // Critical regression test: Apify path used url for link-posts. If this
    // ever flips back to permalink, every arxiv/news card in the widget will
    // mis-route to Reddit comment threads instead of the actual paper.
    const raw = {
      id: "linkpost1",
      title: "Some arxiv paper",
      author: "someuser",
      subreddit: "MachineLearning",
      score: 500,
      num_comments: 30,
      link_flair_text: "Paper",
      permalink: "/r/MachineLearning/comments/linkpost1/some_arxiv_paper/",
      url: "https://arxiv.org/abs/2401.12345",
      created_utc: 1715000000,
      stickied: false,
      over_18: false,
    };

    const post = normalizeRedditJsonPost(raw);

    expect(post.url).toBe("https://arxiv.org/abs/2401.12345");
  });

  it("falls back to permalink-based URL if raw.url is somehow empty", () => {
    const raw = {
      id: "edge1",
      title: "t",
      author: "a",
      subreddit: "s",
      score: 0,
      num_comments: 0,
      link_flair_text: null,
      permalink: "/r/s/comments/edge1/t/",
      url: "",
      created_utc: 1715000000,
      stickied: false,
      over_18: false,
    };

    expect(normalizeRedditJsonPost(raw).url).toBe(
      "https://www.reddit.com/r/s/comments/edge1/t/",
    );
  });

  it("returns null flair when link_flair_text is empty or missing", () => {
    const raw = {
      id: "x",
      title: "t",
      author: "a",
      subreddit: "s",
      score: 0,
      num_comments: 0,
      link_flair_text: "",
      permalink: "/r/s/comments/x/t/",
      url: "https://www.reddit.com/r/s/comments/x/t/",
      created_utc: 1715000000,
      stickied: false,
      over_18: false,
    };
    expect(normalizeRedditJsonPost(raw).flair).toBeNull();
  });
});

describe("isPostKeepable", () => {
  it("rejects stickied posts", () => {
    expect(isPostKeepable({ stickied: true, over_18: false } as never)).toBe(false);
  });
  it("rejects NSFW (over_18) posts", () => {
    expect(isPostKeepable({ stickied: false, over_18: true } as never)).toBe(false);
  });
  it("rejects posts that are both stickied AND nsfw", () => {
    expect(isPostKeepable({ stickied: true, over_18: true } as never)).toBe(false);
  });
  it("accepts ordinary posts", () => {
    expect(isPostKeepable({ stickied: false, over_18: false } as never)).toBe(true);
  });
});

describe("fetchRedditPosts", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns normalized posts from all subreddits, filtering stickied / NSFW / disallowed-flair posts", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const sub = url.match(/\/r\/(\w+)\//)?.[1] ?? "unknown";
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            children: [
              {
                kind: "t3",
                data: {
                  id: `${sub}-1`,
                  title: `${sub} hot post`,
                  author: "user",
                  subreddit: sub,
                  score: 100,
                  num_comments: 10,
                  link_flair_text: "Paper",
                  permalink: `/r/${sub}/comments/${sub}-1/x/`,
                  url: `https://arxiv.org/abs/${sub}-paper`,
                  created_utc: 1715000000,
                  stickied: false,
                  over_18: false,
                },
              },
              {
                kind: "t3",
                data: {
                  id: `${sub}-sticky`,
                  title: `${sub} sticky`,
                  author: "AutoModerator",
                  subreddit: sub,
                  score: 1,
                  num_comments: 0,
                  link_flair_text: null,
                  permalink: `/r/${sub}/comments/${sub}-sticky/y/`,
                  url: `https://www.reddit.com/r/${sub}/comments/${sub}-sticky/y/`,
                  created_utc: 1715000000,
                  stickied: true,
                  over_18: false,
                },
              },
              {
                kind: "t3",
                data: {
                  id: `${sub}-nsfw`,
                  title: `${sub} adult thing`,
                  author: "user",
                  subreddit: sub,
                  score: 999,
                  num_comments: 200,
                  link_flair_text: "Paper",
                  permalink: `/r/${sub}/comments/${sub}-nsfw/n/`,
                  url: `https://www.reddit.com/r/${sub}/comments/${sub}-nsfw/n/`,
                  created_utc: 1715000000,
                  stickied: false,
                  over_18: true,
                },
              },
              {
                kind: "t3",
                data: {
                  id: `${sub}-bad-flair`,
                  title: `${sub} meme`,
                  author: "user",
                  subreddit: sub,
                  score: 5,
                  num_comments: 1,
                  link_flair_text: "Meme",
                  permalink: `/r/${sub}/comments/${sub}-bf/z/`,
                  url: `https://i.redd.it/${sub}-meme.jpg`,
                  created_utc: 1715000000,
                  stickied: false,
                  over_18: false,
                },
              },
            ],
          },
        }),
      } as Response;
    });

    const posts = await fetchRedditPosts();

    // 5 subreddits × 1 keepable post each (sticky + NSFW + bad-flair filtered)
    expect(posts.length).toBe(5);
    expect(posts.every((p) => p.flair === "Paper")).toBe(true);
    // Sanity: no NSFW IDs leaked through
    expect(posts.some((p) => p.id.endsWith("-nsfw"))).toBe(false);
    // url field preserves Apify-style semantic: link-post URL, not Reddit permalink
    expect(posts.every((p) => p.url.startsWith("https://arxiv.org/abs/"))).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(5);
    // User-Agent header required by Reddit
    expect(
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]
        ?.headers?.["User-Agent"],
    ).toMatch(/aip-dash/);
  });

  it("retries once on 429, succeeds on second attempt", async () => {
    // Use fake timers so the 2-5s jitter doesn't actually block the test.
    vi.useFakeTimers();
    let firstCallSeen = false;
    global.fetch = vi.fn().mockImplementation(async () => {
      if (!firstCallSeen) {
        firstCallSeen = true;
        return {
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          json: async () => ({}),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            children: [
              {
                kind: "t3",
                data: {
                  id: "retry-ok",
                  title: "ok after retry",
                  author: "u",
                  subreddit: "s",
                  score: 1,
                  num_comments: 0,
                  link_flair_text: "News",
                  permalink: "/r/s/comments/retry-ok/t/",
                  url: "https://www.reddit.com/r/s/comments/retry-ok/t/",
                  created_utc: 1715000000,
                  stickied: false,
                  over_18: false,
                },
              },
            ],
          },
        }),
      } as Response;
    });

    const promise = fetchRedditPosts();
    // Advance past jitter window (max 5s)
    await vi.advanceTimersByTimeAsync(5000);
    const posts = await promise;

    // First sub: 1 retry succeeded (+1 post). Subs 2-5: each succeed on first try (+4 posts). Total 5.
    expect(posts.length).toBe(5);
    // Total fetch invocations: 1 retry + 5 first-tries = 6
    expect(
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(6);

    vi.useRealTimers();
  });

  it("after retry also fails, returns empty for that subreddit and surfaces warn", async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Pin failure to ONE specific subreddit so both initial + retry hit 429
    // for the same sub. Tracking a global call counter would mis-attribute
    // the 2 failures across 2 different subs (allSettled fires all 5 in
    // parallel), and we'd see 5 posts instead of the expected 4.
    const FAILING_SUB = "MachineLearning";
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const sub = url.match(/\/r\/(\w+)\//)?.[1] ?? "";
      if (sub === FAILING_SUB) {
        return {
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          json: async () => ({}),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            children: [
              {
                kind: "t3",
                data: {
                  id: `${sub}-1`,
                  title: "t",
                  author: "u",
                  subreddit: sub,
                  score: 1,
                  num_comments: 0,
                  link_flair_text: "News",
                  permalink: `/r/${sub}/comments/x/t/`,
                  url: `https://www.reddit.com/r/${sub}/comments/x/t/`,
                  created_utc: 1715000000,
                  stickied: false,
                  over_18: false,
                },
              },
            ],
          },
        }),
      } as Response;
    });

    const promise = fetchRedditPosts();
    await vi.advanceTimersByTimeAsync(5000);
    const posts = await promise;

    // 4 succeeding subs × 1 post = 4
    expect(posts.length).toBe(4);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Non-200 response"));
    vi.useRealTimers();
    warnSpy.mockRestore();
  });

  it("treats missing data.children as empty (no crash, no posts)", async () => {
    // Reddit occasionally returns 200 with a body shaped like {} during
    // internal errors — code path: json.data?.children ?? []
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    const posts = await fetchRedditPosts();

    expect(posts).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(5);
  });

  it("filters non-t3 kinds (comments, subreddit-promos) from the children array", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          children: [
            { kind: "t1", data: { body: "i am a comment" } },
            { kind: "t5", data: { display_name: "a promoted subreddit" } },
            {
              kind: "t3",
              data: {
                id: "real-post",
                title: "actual post",
                author: "u",
                subreddit: "MachineLearning",
                score: 10,
                num_comments: 2,
                link_flair_text: "Paper",
                permalink: "/r/MachineLearning/comments/real-post/x/",
                url: "https://arxiv.org/abs/real-post",
                created_utc: 1715000000,
                stickied: false,
                over_18: false,
              },
            },
          ],
        },
      }),
    } as Response);

    const posts = await fetchRedditPosts();

    // 5 subreddits × 1 t3 post each = 5 posts; t1/t5 silently dropped
    expect(posts.length).toBe(5);
    expect(posts.every((p) => p.id === "real-post")).toBe(true);
  });

  it("when response body is not JSON, surfaces the rejection and returns empty for that subreddit", async () => {
    // Mocked res.json() that throws — simulates Reddit serving an HTML
    // error page with content-type application/json (yes, this happens).
    // Promise.allSettled in fetchRedditPosts should catch the per-subreddit
    // rejection and continue; warnSpy confirms we logged it.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON at position 0");
      },
    } as unknown as Response);

    const posts = await fetchRedditPosts();

    // All 5 subreddits' json() threw; allSettled caught each; result is empty.
    expect(posts).toEqual([]);
    // The top-level allSettled-rejected warn fires once per subreddit (5x)
    expect(warnSpy).toHaveBeenCalledWith(
      "[reddit] subreddit fetch rejected:",
      expect.any(SyntaxError),
    );
    warnSpy.mockRestore();
  });
});
