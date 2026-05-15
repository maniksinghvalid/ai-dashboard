import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeRedditAtomEntry, fetchRedditPosts } from "./reddit";

// Stub cacheSet so tests don't hit Redis. ./reddit itself is NOT mocked — we
// exercise its real fetch → rss-parser → normalize pipeline against a mocked
// global.fetch that returns Reddit-shaped Atom XML.
vi.mock("@/lib/cache/helpers", () => ({
  cacheSet: vi.fn().mockResolvedValue(true),
}));

// ── Atom fixture builders ──────────────────────────────────────────────────
// The <entry> structure here is verbatim-shaped from a real Reddit hot.rss
// response (captured from www.reddit.com/r/LocalLLaMA/hot.rss, 2026-05):
// <author> carries BOTH <name> and <uri>, plus <category>/<content>/
// <media:thumbnail>/<published>. This matters — it pins how rss-parser
// actually parses Reddit's <author> (→ a plain string on item.author), so
// these integration tests exercise the real parse path, not a simplified shape.
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
    .map((e) => {
      const author = e.author ?? "/u/someuser";
      const href = e.href ?? "https://www.reddit.com/r/x/comments/default/t/";
      const updated = e.updated ?? "2026-05-14T10:00:00+00:00";
      const userSlug = author.replace(/^\/u\//, "");
      return `<entry><author><name>${author}</name><uri>https://www.reddit.com/user/${userSlug}</uri></author><category term="x" label="r/x"/><content type="html">&lt;div&gt;body&lt;/div&gt;</content><id>${e.id ?? "t3_default"}</id><media:thumbnail url="https://i.redd.it/x.jpeg" /><link href="${href}" /><updated>${updated}</updated><published>${updated}</published><title>${e.title ?? "Default title"}</title></entry>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom"><title>r/feed</title>${items}</feed>`;
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
      "singularity",
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
      // Titles carry an AI keyword so r/programming (aiFilter:true) survives
      // its keyword filter — this test asserts all 5 subs contribute a post.
      return okResponse(
        atomFeed([
          {
            id: `t3_${sub}1`,
            title: `${sub} AI hot post`,
            href: `https://www.reddit.com/r/${sub}/comments/${sub}1/x/`,
            author: "/u/poster",
          },
        ]),
      );
    });

    const posts = await fetchRedditPosts();

    expect(posts.length).toBe(5);
    expect(posts.every((p) => p.id.endsWith("1"))).toBe(true);
    // rss-parser must yield a clean string author from the real <author> shape
    // (<name> + <uri> children) — guards against an "[object Object]" regression
    // if rss-parser ever stops flattening Atom <author> to a string.
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
      return okResponse(atomFeed([{ id: `t3_${sub}1`, title: `${sub} AI post` }]));
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
      return okResponse(atomFeed([{ id: `t3_${sub}1`, title: `${sub} AI post` }]));
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

  // ── aiFilter (config-driven AI-keyword title filter) ─────────────────────
  // r/programming is the sole SUBREDDITS entry with aiFilter:true.

  // Fetch mock: r/programming returns one post titled `programmingTitle`; every
  // other subreddit returns one post with an AI-keyword title — so only the
  // aiFilter branch is under test, the other 4 subs always contribute a post.
  function aiFilterFetchMock(programmingTitle: string) {
    return vi.fn().mockImplementation(async (url: string) => {
      const sub = url.match(/\/r\/(\w+)\//)?.[1] ?? "unknown";
      const title = sub === "programming" ? programmingTitle : `${sub} AI post`;
      return okResponse(atomFeed([{ id: `t3_${sub}1`, title }]));
    });
  }

  it("drops aiFilter-subreddit posts whose title has no AI keyword", async () => {
    global.fetch = aiFilterFetchMock("weekly career advice thread");

    const posts = await fetchRedditPosts();

    // programming's lone keyword-free post is filtered out → 4 of 5 subs left
    expect(posts.length).toBe(4);
    expect(posts.some((p) => p.subreddit === "programming")).toBe(false);
  });

  it("keeps aiFilter-subreddit posts with an AI keyword (case-insensitive)", async () => {
    global.fetch = aiFilterFetchMock(
      "Shipping a local LLM with GPT-style tooling",
    );

    const posts = await fetchRedditPosts();

    expect(posts.length).toBe(5);
    expect(posts.some((p) => p.subreddit === "programming")).toBe(true);
  });

  it.each(["llm", "ai", "gpt", "claude", "model", "neural", "transformer"])(
    "keeps an aiFilter-subreddit post when the title contains %s",
    async (keyword) => {
      global.fetch = aiFilterFetchMock(`a deep dive on ${keyword} today`);

      const posts = await fetchRedditPosts();

      expect(posts.some((p) => p.subreddit === "programming")).toBe(true);
    },
  );

  it("matches plural keyword forms (LLMs, GPTs, models)", async () => {
    global.fetch = aiFilterFetchMock("Top 5 LLMs compared");

    const posts = await fetchRedditPosts();

    expect(posts.some((p) => p.subreddit === "programming")).toBe(true);
  });

  it("respects word boundaries — substring-only matches are dropped", async () => {
    // "rain" and "detail" contain the substring "ai" but not as a whole word.
    global.fetch = aiFilterFetchMock("Avoiding rain delays in detail");

    const posts = await fetchRedditPosts();

    expect(posts.some((p) => p.subreddit === "programming")).toBe(false);
  });

  it("filters a mixed feed — keeps AI titles, drops the rest", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const sub = url.match(/\/r\/(\w+)\//)?.[1] ?? "unknown";
      if (sub === "programming") {
        return okResponse(
          atomFeed([
            { id: "t3_p1", title: "New transformer paper" },
            { id: "t3_p2", title: "Garden hose review" },
            { id: "t3_p3", title: "GPT prompt tips" },
          ]),
        );
      }
      return okResponse(
        atomFeed([{ id: `t3_${sub}1`, title: `${sub} AI post` }]),
      );
    });

    const posts = await fetchRedditPosts();

    const programmingIds = posts
      .filter((p) => p.subreddit === "programming")
      .map((p) => p.id)
      .sort();
    expect(programmingIds).toEqual(["p1", "p3"]);
  });

  it("does not filter subreddits without the aiFilter flag", async () => {
    // Keyword-free titles everywhere: the 4 non-aiFilter subs keep their post,
    // only r/programming (aiFilter:true) is narrowed to nothing.
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const sub = url.match(/\/r\/(\w+)\//)?.[1] ?? "unknown";
      return okResponse(
        atomFeed([{ id: `t3_${sub}1`, title: "weekly discussion thread" }]),
      );
    });

    const posts = await fetchRedditPosts();

    expect(posts.length).toBe(4);
    expect(posts.every((p) => p.subreddit !== "programming")).toBe(true);
  });
});
