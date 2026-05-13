import { describe, it, expect } from "vitest";
import { normalizeRedditJsonPost, isPostKeepable } from "./reddit";

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
