// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PaginationFooter } from "@/components/ui/PaginationFooter";

afterEach(cleanup);

function renderFooter(overrides: Partial<React.ComponentProps<typeof PaginationFooter>> = {}) {
  const props: React.ComponentProps<typeof PaginationFooter> = {
    page: 1,
    totalPages: 3,
    hasPrev: false,
    hasNext: true,
    onPrev: () => {},
    onNext: () => {},
    rangeLabel: "1–15 of 33",
    hidden: false,
    ...overrides,
  };
  return render(<PaginationFooter {...props} />);
}

describe("PaginationFooter (SCRUM-50)", () => {
  it("renders nothing when hidden is true", () => {
    const { container } = renderFooter({ hidden: true });
    expect(container.firstChild).toBeNull();
  });

  it("renders Prev/Next buttons, the page label, and the range counter", () => {
    renderFooter({ page: 2, totalPages: 3, hasPrev: true, hasNext: true, rangeLabel: "16–30 of 33" });

    expect(screen.getByRole("button", { name: "Previous page" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next page" })).toBeTruthy();
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
    expect(screen.getByText("16–30 of 33")).toBeTruthy();
  });

  it("disables Prev on page 1 and Next on the last page", () => {
    const { rerender } = renderFooter({ page: 1, totalPages: 3, hasPrev: false, hasNext: true });

    const prev = screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    rerender(
      <PaginationFooter
        page={3}
        totalPages={3}
        hasPrev={true}
        hasNext={false}
        onPrev={() => {}}
        onNext={() => {}}
        rangeLabel="31–33 of 33"
        hidden={false}
      />,
    );
    const prev2 = screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement;
    const next2 = screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement;
    expect(prev2.disabled).toBe(false);
    expect(next2.disabled).toBe(true);
  });

  it("fires onPrev / onNext when their buttons are clicked", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    renderFooter({ page: 2, totalPages: 3, hasPrev: true, hasNext: true, onPrev, onNext });

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("does NOT call handlers when buttons are disabled at boundaries", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    // page 1, hasPrev=false → prev disabled. The button is still in the DOM
    // but click events should not invoke onPrev (browser semantics).
    renderFooter({ page: 1, totalPages: 3, hasPrev: false, hasNext: true, onPrev, onNext });

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPrev).not.toHaveBeenCalled();
  });

  it("the page-status text region is announced politely to assistive tech", () => {
    renderFooter({ page: 2, totalPages: 5, hasPrev: true, hasNext: true });

    // The element that holds "Page 2 of 5" should expose aria-live=polite so
    // screen readers announce the change without being interrupted.
    const status = screen.getByText("Page 2 of 5");
    // The aria-live attribute might be on this element or on a parent. Walk up
    // the tree until we find it, or fail with a clear message.
    let node: HTMLElement | null = status;
    let found: string | null = null;
    while (node) {
      const v = node.getAttribute("aria-live");
      if (v) {
        found = v;
        break;
      }
      node = node.parentElement;
    }
    expect(found).toBe("polite");
  });
});
