// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { YouTubeWidget } from "@/components/widgets/YouTubeWidget";
import type { Video } from "@/lib/types";

afterEach(cleanup);

/**
 * Helper: fabricate `n` `Video` objects with required fields.
 * Empty `thumbnailUrl` makes the conditional `video.thumbnailUrl ? <Image .../> : null`
 * skip the `<Image>` element entirely, so jsdom is unaffected.
 */
function makeVideos(n: number): Video[] {
  const now = new Date().toISOString();
  const videos: Video[] = [];
  for (let i = 0; i < n; i += 1) {
    videos.push({
      id: `v${i}`,
      title: `Video ${i}`,
      channelName: "ch",
      channelId: "c",
      thumbnailUrl: "",
      viewCount: 1000,
      publishedAt: now,
      viewVelocity: 0,
      url: `https://youtu.be/v${i}`,
    });
  }
  return videos;
}

describe("YouTubeWidget render-time contract (D1 cap + D9 badge + D3 scrollable wiring)", () => {
  it("Test 1 (D1 cap to 15): given 25 videos, renders exactly 15 <a> link elements", () => {
    render(
      <YouTubeWidget
        videos={makeVideos(25)}
        stale={false}
        isLoading={false}
        error={null}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links.length).toBe(15);
  });

  it("Test 2 (D9 badge text — happy path): given 7 videos, renders the '7 new' badge", () => {
    render(
      <YouTubeWidget
        videos={makeVideos(7)}
        stale={false}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText("7 new")).toBeDefined();
  });

  it("Test 3 (D9 badge text — exactly at the cap): given 15 videos, badge reads '15 new' (live array length, not post-cap)", () => {
    render(
      <YouTubeWidget
        videos={makeVideos(15)}
        stale={false}
        isLoading={false}
        error={null}
      />,
    );

    // Even though cap == array length here, the badge reads live array length per D9.
    expect(screen.getByText("15 new")).toBeDefined();
  });

  it("Test 4 (scrollable wiring on populated branch): with 5 videos, the rendered DOM contains a region with aria-label='YouTube feed, scrollable'", () => {
    render(
      <YouTubeWidget
        videos={makeVideos(5)}
        stale={false}
        isLoading={false}
        error={null}
      />,
    );

    const region = screen.getByRole("region");
    expect(region.getAttribute("aria-label")).toBe("YouTube feed, scrollable");
  });

  it("Test 5 (empty branch): with [] videos, no region is rendered and 'No videos available' is shown", () => {
    render(
      <YouTubeWidget
        videos={[]}
        stale={false}
        isLoading={false}
        error={null}
      />,
    );

    // Empty branch must NOT pass scrollable to WidgetCard — no region landmark.
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByText("No videos available")).toBeDefined();
  });
});
