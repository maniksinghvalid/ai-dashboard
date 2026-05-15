// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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
    expect(region).toHaveAttribute("tabIndex", "0");
    expect(region).toHaveAttribute("aria-label", "YouTube feed, scrollable");
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
