import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeRedditAtomEntry, fetchRedditPosts } from "./reddit";

// Stub cacheSet so tests don't hit Redis. ./reddit itself is NOT mocked — we
// exercise its real fetch → rss-parser → normalize pipeline against a mocked
// global.fetch that returns Reddit-shaped Atom XML.
vi.mock("@/lib/cache/helpers", () => ({
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

// ── Atom fixture builders ──────────────────────────────────────────────────
function atomFeed(
  entries: Array<{
    id?: string;
    title?: string;
    href?: string;
    author?: string;
    updated?: string;
  }>,
): string {
  const items = entries
    .map(
      (e) => `  <entry>
    <author><name>${e.author ?? "/u/someuser"}</name></author>
    <id>${e.id ?? "t3_default"}</id>
    <link href="${e.href ?? "https://www.reddit.com/r/x/comments/default/t/"}" />
    <updated>${e.updated ?? "2026-05-14T10:00:00+00:00"}</updated>
    <title>${e.title ?? "Default title"}</title>
  </entry>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>r/feed</title>
${items}
</feed>`;
}

function okResponse(xml: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => xml,
  } as Response;
}

// ── normalizeRedditAtomEntry ───────────────────────────────────────────────
describe("normalizeRedditAtomEntry", () => {
  it("maps a full Atom item to RedditPost, stripping t3_ and /u/ prefixes", () => {
    const post = normalizeRedditAtomEntry(
      {
        id: "t3_abc123",
        title: "Sample post title",
        link: "https://www.reddit.com/r/MachineLearning/comments/abc123/sample/",
        author: "/u/someuser",
        isoDate: "2026-05-14T10:00:00.000Z",
      },
      "MachineLearning",
    );

    expect(post).toEqual({
      id: "abc123",
      title: "Sample post title",
      author: "someuser",
      subreddit: "MachineLearning",
      url: "https://www.reddit.com/r/MachineLearning/comments/abc123/sample/",
      createdAt: "2026-05-14T10:00:00.000Z",
    });
  });

  it("keeps id and author as-is when the t3_ / /u/ prefixes are absent", () => {
    const post = normalizeRedditAtomEntry(
      { id: "abc123", title: "t", link: "https://x", author: "someuser", isoDate: "2026-05-14T10:00:00.000Z" },
      "artificial",
    );
    expect(post.id).toBe("abc123");
    expect(post.author).toBe("someuser");
  });

  it("falls back when title / link / author / date are missing", () => {
    const post = normalizeRedditAtomEntry({ id: "t3_x" }, "LocalLLaMA");
    expect(post.title).toBe("Untitled");
    expect(post.author).toBe("unknown");
    expect(post.url).toBe("https://www.reddit.com/r/LocalLLaMA/");
    // missing both dates → a valid ISO timestamp (now)
    expect(() => new Date(post.createdAt).toISOString()).not.toThrow();
    expect(Number.isNaN(new Date(post.createdAt).getTime())).toBe(false);
  });

  it("uses pubDate when isoDate is absent", () => {
    const post = normalizeRedditAtomEntry(
      { id: "t3_x", pubDate: "2026-05-01T00:00:00.000Z" },
      "ChatGPT",
    );
    expect(post.createdAt).toBe("2026-05-01T00:00:00.000Z");
  });
});

// ── fetchRedditPosts ───────────────────────────────────────────────────────
describe("fetchRedditPosts", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns normalized posts from all 5 subreddits", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const sub = url.match(/\/r\/(\w+)\//)?.[1] ?? "unknown";
      return okResponse(
        atomFeed([
          {
            id: `t3_${sub}1`,
            title: `${sub} hot post`,
            href: `https://www.reddit.com/r/${sub}/comments/${sub}1/x/`,
            author: "/u/poster",
          },
        ]),
      );
    });

    const posts = await fetchRedditPosts();

    expect(posts.length).toBe(5);
    expect(posts.every((p) => p.id.endsWith("1"))).toBe(true);
    expect(posts.every((p) => p.author === "poster")).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(5);
    // .rss endpoint + User-Agent header
    const firstCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(firstCall[0]).toMatch(/hot\.rss/);
    expect(firstCall[1]?.headers?.["User-Agent"]).toMatch(/aip-dash/);
  });

  it("isolates a per-subreddit non-200 failure and keeps the other 4", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const FAILING_SUB = "MachineLearning";
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const sub = url.match(/\/r\/(\w+)\//)?.[1] ?? "";
      if (sub === FAILING_SUB) {
        return { ok: false, status: 403, statusText: "Blocked", text: async () => "" } as Response;
      }
      return okResponse(atomFeed([{ id: `t3_${sub}1`, title: `${sub} post` }]));
    });

    const posts = await fetchRedditPosts();

    expect(posts.length).toBe(4);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Non-200 response for r/MachineLearning"));
    warnSpy.mockRestore();
  });

  it("returns [] when every subreddit is 403-blocked", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 403, statusText: "Blocked", text: async () => "" } as Response);

    const posts = await fetchRedditPosts();

    expect(posts).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(5);
    warnSpy.mockRestore();
  });

  it("retries once on 429 and succeeds on the second attempt", async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let firstCallSeen = false;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const sub = url.match(/\/r\/(\w+)\//)?.[1] ?? "s";
      if (!firstCallSeen) {
        firstCallSeen = true;
        return { ok: false, status: 429, statusText: "Too Many Requests", text: async () => "" } as Response;
      }
      return okResponse(atomFeed([{ id: `t3_${sub}1`, title: `${sub} post` }]));
    });

    const promise = fetchRedditPosts();
    await vi.advanceTimersByTimeAsync(5000);
    const posts = await promise;

    // 1 sub retried (1 post) + 4 subs first-try (4 posts) = 5
    expect(posts.length).toBe(5);
    // 1 retry + 5 first-tries = 6 fetch invocations
    expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(6);

    vi.useRealTimers();
    warnSpy.mockRestore();
  });

  it("treats a malformed feed body as a per-subreddit rejection and continues", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    global.fetch = vi
      .fn()
      .mockResolvedValue(okResponse("this is not valid xml at all"));

    const posts = await fetchRedditPosts();

    // every sub's parseString threw; allSettled caught each → empty result
    expect(posts).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      "[reddit] subreddit fetch rejected:",
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it("treats a feed with no entries as zero posts (no crash)", async () => {
    global.fetch = vi.fn().mockResolvedValue(okResponse(atomFeed([])));

    const posts = await fetchRedditPosts();

    expect(posts).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(5);
  });
});
