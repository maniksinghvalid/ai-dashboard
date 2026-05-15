// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { WidgetCard } from "@/components/widgets/WidgetCard";

afterEach(cleanup);

// Helper: set scroll geometry on the region so we can simulate overflow / at-bottom
function setScrollGeometry(
  el: HTMLElement,
  geom: { scrollTop?: number; clientHeight?: number; scrollHeight?: number },
) {
  if (geom.scrollTop !== undefined) {
    Object.defineProperty(el, "scrollTop", { value: geom.scrollTop, configurable: true });
  }
  if (geom.clientHeight !== undefined) {
    Object.defineProperty(el, "clientHeight", { value: geom.clientHeight, configurable: true });
  }
  if (geom.scrollHeight !== undefined) {
    Object.defineProperty(el, "scrollHeight", { value: geom.scrollHeight, configurable: true });
  }
}

describe("WidgetCard scrollable contract (D3/D4/D5/D8)", () => {
  it("Test 1 (D3 + D8): renders a region with tabIndex, role, and aria-label when scrollable=true", () => {
    render(
      <WidgetCard
        icon="X"
        iconBg="#000"
        title="YouTube"
        scrollable
        maxBodyHeight="max-h-[320px]"
      >
        <div>item</div>
      </WidgetCard>,
    );

    const region = screen.getByRole("region");
    // tabIndex is exposed as "0" via getAttribute (React serializes the prop)
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.getAttribute("aria-label")).toBe("YouTube feed, scrollable");
    expect(region.getAttribute("role")).toBe("region");
  });

  it("Test 2 (D3 backward compat): omitting scrollable renders NO region and preserves the existing px-3.5 py-2.5 body wrapper", () => {
    const { container } = render(
      <WidgetCard icon="X" iconBg="#000" title="Trending">
        <div>child-content-marker</div>
      </WidgetCard>,
    );

    // No region landmark in the non-scrollable branch
    expect(screen.queryByRole("region")).toBeNull();

    // The original body wrapper (<div className="px-3.5 py-2.5">) is preserved byte-identically
    const bodyWrapper = Array.from(container.querySelectorAll("div")).find(
      (d) => d.className === "px-3.5 py-2.5",
    );
    expect(bodyWrapper).toBeDefined();
    expect(bodyWrapper?.textContent).toContain("child-content-marker");
  });

  it("Test 3 (D4): renders an aria-hidden gradient fade overlay inside the region when content overflows", () => {
    const { container } = render(
      <WidgetCard
        icon="X"
        iconBg="#000"
        title="YouTube"
        scrollable
        maxBodyHeight="max-h-[320px]"
      >
        <div style={{ height: 1000 }}>tall</div>
      </WidgetCard>,
    );

    const region = screen.getByRole("region");
    // Force the geometry to "overflowing, not at bottom" so the initial useEffect check leaves the fade visible.
    // The component reads scroll geometry inside its useEffect; we configure the DOM properties before any
    // subsequent scroll event but the initial check ran with jsdom defaults (all 0). To make the fade visible
    // we don't need to mutate here — jsdom defaults yield 0+0 >= 0-1 = true so atBottom would be true initially.
    // Therefore we must simulate "overflowing, not at bottom" by mutating geometry THEN firing a scroll.
    setScrollGeometry(region, { scrollTop: 0, clientHeight: 320, scrollHeight: 1000 });
    fireEvent.scroll(region);

    // After this scroll event, the listener re-evaluates and atBottom becomes false → fade is rendered.
    const overlay = container.querySelector('[aria-hidden="true"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toContain("bg-gradient-to-t");
    expect(overlay?.className).toContain("pointer-events-none");
  });

  it("Test 4 (D5): scroll-to-bottom hides the fade overlay", () => {
    const { container } = render(
      <WidgetCard
        icon="X"
        iconBg="#000"
        title="YouTube"
        scrollable
        maxBodyHeight="max-h-[320px]"
      >
        <div style={{ height: 1000 }}>tall</div>
      </WidgetCard>,
    );

    const region = screen.getByRole("region");

    // Step 1: simulate "overflowing, not at bottom" → fade visible
    setScrollGeometry(region, { scrollTop: 0, clientHeight: 320, scrollHeight: 1000 });
    fireEvent.scroll(region);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();

    // Step 2: simulate "scrolled to bottom" (scrollTop + clientHeight >= scrollHeight - 1)
    setScrollGeometry(region, { scrollTop: 9999, clientHeight: 320, scrollHeight: 320 });
    fireEvent.scroll(region);

    // Fade is no longer in the DOM
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("Test 5 (D8): the scroll region has focus-visible accent ring classes + outline-none", () => {
    render(
      <WidgetCard
        icon="X"
        iconBg="#000"
        title="YouTube"
        scrollable
        maxBodyHeight="max-h-[320px]"
      >
        <div>item</div>
      </WidgetCard>,
    );

    const region = screen.getByRole("region");
    const cls = region.className;
    expect(cls).toContain("outline-none");
    expect(cls).toContain("focus-visible:ring-1");
    expect(cls).toContain("focus-visible:ring-accent");
    expect(cls).toContain("focus-visible:ring-inset");
  });

  it("Test 6 (D5): initial no-overflow case — fade overlay is NOT rendered", async () => {
    const { container } = render(
      <WidgetCard
        icon="X"
        iconBg="#000"
        title="YouTube"
        scrollable
        maxBodyHeight="max-h-[320px]"
      >
        <div style={{ height: 1 }}>short</div>
      </WidgetCard>,
    );

    // With jsdom defaults the synchronous initial check() inside useEffect runs against
    // scrollTop=0, clientHeight=0, scrollHeight=0 → 0+0 >= 0-1 → true → atBottom=true → no fade.
    // Wait one microtask in case React batches the state update.
    await Promise.resolve();

    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});

describe("WidgetCard pagination extensions (SCRUM-50)", () => {
  it("renders the `footer` slot below the body, inside the card border, when provided", () => {
    const { container } = render(
      <WidgetCard
        icon="X"
        iconBg="#000"
        title="YouTube"
        scrollable
        maxBodyHeight="max-h-[320px]"
        footer={<div data-testid="footer-marker">FOOTER</div>}
      >
        <div data-testid="body-marker">BODY</div>
      </WidgetCard>,
    );

    const footer = screen.getByTestId("footer-marker");
    const body = screen.getByTestId("body-marker");
    expect(footer).toBeTruthy();
    expect(body).toBeTruthy();

    // The footer must come *after* the scrollable region in document order so
    // it renders at the bottom of the card.
    const region = screen.getByRole("region");
    expect(
      region.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // The card root must contain both the region and the footer (footer is
    // inside the card border, not a separate sibling).
    const cardRoot = container.querySelector("div.group");
    expect(cardRoot?.contains(region)).toBe(true);
    expect(cardRoot?.contains(footer)).toBe(true);
  });

  it("omits the footer slot entirely when no `footer` prop is passed", () => {
    const { container } = render(
      <WidgetCard
        icon="X"
        iconBg="#000"
        title="YouTube"
        scrollable
        maxBodyHeight="max-h-[320px]"
      >
        <div>BODY</div>
      </WidgetCard>,
    );

    expect(container.querySelector('[data-testid="footer-marker"]')).toBeNull();
  });

  it("on paginationKey change: fades the body via data-paging, then resets scrollTop and clears the attribute", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <WidgetCard
          icon="X"
          iconBg="#000"
          title="YouTube"
          scrollable
          maxBodyHeight="max-h-[320px]"
          paginationKey={1}
        >
          <div style={{ height: 1000 }}>page 1</div>
        </WidgetCard>,
      );

      const region = screen.getByRole("region");
      // Pre-populate scroll position so we can verify the reset
      Object.defineProperty(region, "scrollTop", { value: 250, configurable: true, writable: true });
      expect((region as HTMLElement).scrollTop).toBe(250);

      // First mount must NOT trigger the fade (initial render shouldn't flash)
      expect(region.getAttribute("data-paging")).not.toBe("out");

      // Change the key — simulating Next ›
      rerender(
        <WidgetCard
          icon="X"
          iconBg="#000"
          title="YouTube"
          scrollable
          maxBodyHeight="max-h-[320px]"
          paginationKey={2}
        >
          <div style={{ height: 1000 }}>page 2</div>
        </WidgetCard>,
      );

      // After the effect runs, region should be in the "paging out" state
      expect(region.getAttribute("data-paging")).toBe("out");

      // Advance past the 120ms fade timer; effect should reset scroll + flip state
      act(() => {
        vi.advanceTimersByTime(120);
      });
      expect((region as HTMLElement).scrollTop).toBe(0);
      expect(region.getAttribute("data-paging")).not.toBe("out");
    } finally {
      vi.useRealTimers();
    }
  });

  it("scrollable region carries the transition-opacity class so paging fades render", () => {
    render(
      <WidgetCard
        icon="X"
        iconBg="#000"
        title="YouTube"
        scrollable
        maxBodyHeight="max-h-[320px]"
        paginationKey={1}
      >
        <div>item</div>
      </WidgetCard>,
    );

    const region = screen.getByRole("region");
    expect(region.className).toContain("transition-opacity");
  });
});
