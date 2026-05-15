// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RedditWidget } from "@/components/widgets/RedditWidget";
import type { RedditPost } from "@/lib/types";

afterEach(cleanup);

// Fabricate n RedditPost objects with all required fields. RedditPost is
// RSS-sourced: id, title, author, subreddit, url, createdAt (no score /
// comments / flair — those don't exist on the Atom feed).
function makePosts(n: number): RedditPost[] {
  const now = new Date().toISOString();
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    title: `Post ${i}`,
    author: `user${i}`,
    subreddit: "MachineLearning",
    url: `https://reddit.com/r/MachineLearning/p${i}`,
    createdAt: now,
  }));
}

describe("RedditWidget render contract (D1, D3, badge preservation)", () => {
  it("Test 1 (D1): caps rendered rows at MAX_FEED_ITEMS (15) when given 30 posts", () => {
    render(
      <RedditWidget
        posts={makePosts(30)}
        stale={false}
        isLoading={false}
        error={null}
      />,
    );

    // Each post row is rendered as a single <a> link. 30 posts → 15 links.
    expect(screen.getAllByRole("link").length).toBe(15);
  });

  it("Test 2 (D3): populated branch wires scrollable region with aria-label='Reddit feed, scrollable'", () => {
    render(
      <RedditWidget
        posts={makePosts(5)}
        stale={false}
        isLoading={false}
        error={null}
      />,
    );

    const region = screen.getByRole("region");
    expect(region.getAttribute("aria-label")).toBe("Reddit feed, scrollable");
  });

  it("Test 3 (D3 backward compat): empty branch renders no region and shows 'No posts available'", () => {
    render(
      <RedditWidget
        posts={[]}
        stale={false}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByText("No posts available")).toBeDefined();
  });

  it("Test 4 (badge preservation): static badge 'r/ML · r/AI' is rendered", () => {
    render(
      <RedditWidget
        posts={makePosts(3)}
        stale={false}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText("r/ML · r/AI")).toBeDefined();
  });
});
