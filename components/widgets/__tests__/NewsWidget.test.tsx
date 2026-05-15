// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NewsWidget } from "@/components/widgets/NewsWidget";
import type { NewsItem } from "@/lib/types";

afterEach(cleanup);

function makeNews(n: number): NewsItem[] {
  const now = new Date().toISOString();
  return Array.from({ length: n }, (_, i) => ({
    title: `News ${i}`,
    link: `https://example.com/news-${i}`,
    source: "TechCrunch",
    publishedAt: now,
    summary: `Summary ${i}`,
  }));
}

describe("NewsWidget (D1 cap + D9 badge + scrollable wiring)", () => {
  it("Test 1 (D1): caps render at 15 rows when given 30 items", () => {
    render(
      <NewsWidget items={makeNews(30)} stale={false} isLoading={false} error={null} />,
    );

    const links = screen.getAllByRole("link");
    expect(links.length).toBe(15);
  });

  it("Test 2 (D9 happy path): given 8 items, badge text contains `8 new`", () => {
    render(
      <NewsWidget items={makeNews(8)} stale={false} isLoading={false} error={null} />,
    );

    expect(screen.getByText(/8 new/)).toBeTruthy();
  });

  it("Test 3 (D9 at cap): given 15 items, badge text contains `15 new`", () => {
    render(
      <NewsWidget items={makeNews(15)} stale={false} isLoading={false} error={null} />,
    );

    expect(screen.getByText(/15 new/)).toBeTruthy();
  });

  it("Test 4 (scrollable wiring on populated branch): a `role=region` with aria-label `AI News feed, scrollable` is present when items render", () => {
    render(
      <NewsWidget items={makeNews(5)} stale={false} isLoading={false} error={null} />,
    );

    const region = screen.getByRole("region");
    expect(region.getAttribute("aria-label")).toBe("AI News feed, scrollable");
  });

  it("Test 5 (empty branch — no scrollable, fallback copy rendered)", () => {
    render(
      <NewsWidget items={[]} stale={false} isLoading={false} error={null} />,
    );

    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByText(/No news available/)).toBeTruthy();
  });
});
