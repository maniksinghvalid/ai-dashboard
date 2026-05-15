// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { XFeedWidget } from "@/components/widgets/XFeedWidget";
import type { Tweet } from "@/lib/types";

afterEach(cleanup);

function makeTweets(n: number): Tweet[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    text: `Tweet ${i}`,
    authorName: `Author ${i}`,
    authorHandle: `a${i}`,
    createdAt: new Date().toISOString(),
    likeCount: 10,
    retweetCount: 1,
    url: `https://x.com/a${i}/status/t${i}`,
  }));
}

describe("XFeedWidget render-time slice + scrollable wiring (D1, SC-1, SC-6, D7)", () => {
  it("Test 1 (D1): renders exactly 15 link rows when given 30 tweets", () => {
    render(
      <XFeedWidget
        tweets={makeTweets(30)}
        stale={false}
        isLoading={false}
        error={null}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(15);
  });

  it("Test 2 (SC-1/SC-6): passes scrollable wiring to WidgetCard on the populated branch", () => {
    render(
      <XFeedWidget
        tweets={makeTweets(5)}
        stale={false}
        isLoading={false}
        error={null}
      />,
    );

    const region = screen.getByRole("region");
    expect(region.getAttribute("aria-label")).toBe("X / Twitter feed, scrollable");
  });

  it("Test 3 (empty branch — no scrollable): does NOT render region when tweets is empty", () => {
    render(
      <XFeedWidget
        tweets={[]}
        stale={false}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByText("No tweets available")).not.toBeNull();
  });

  it("Test 4 (gradient rotation past index 5): renders all 12 rows without error", () => {
    render(
      <XFeedWidget
        tweets={makeTweets(12)}
        stale={false}
        isLoading={false}
        error={null}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(12);
  });
});
