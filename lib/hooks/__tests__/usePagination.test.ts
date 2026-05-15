// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { usePagination } from "@/lib/hooks/usePagination";

afterEach(cleanup);

type Item = { id: string };

function items(n: number, prefix = "a"): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }));
}

describe("usePagination (SCRUM-50)", () => {
  it("slices items into pages of pageSize and reports boundaries", () => {
    const data = items(33);
    const { result } = renderHook(() =>
      usePagination(data, 15, (item) => item.id),
    );

    expect(result.current.totalPages).toBe(3);
    expect(result.current.pageItems).toHaveLength(15);
    expect(result.current.pageItems[0].id).toBe("a0");
    expect(result.current.pageItems[14].id).toBe("a14");
    expect(result.current.page).toBe(1);
    expect(result.current.hasPrev).toBe(false);
    expect(result.current.hasNext).toBe(true);
    expect(result.current.rangeLabel).toBe("1–15 of 33");
    expect(result.current.showFooter).toBe(true);
  });

  it("goNext advances and goPrev rewinds; both clamp at boundaries", () => {
    const data = items(33);
    const { result } = renderHook(() =>
      usePagination(data, 15, (item) => item.id),
    );

    act(() => result.current.goNext());
    expect(result.current.page).toBe(2);
    expect(result.current.pageItems[0].id).toBe("a15");
    expect(result.current.rangeLabel).toBe("16–30 of 33");

    act(() => result.current.goNext());
    expect(result.current.page).toBe(3);
    expect(result.current.pageItems).toHaveLength(3);
    expect(result.current.pageItems[0].id).toBe("a30");
    expect(result.current.pageItems[2].id).toBe("a32");
    expect(result.current.rangeLabel).toBe("31–33 of 33");
    expect(result.current.hasNext).toBe(false);

    // goNext at last page is a no-op
    act(() => result.current.goNext());
    expect(result.current.page).toBe(3);

    act(() => result.current.goPrev());
    expect(result.current.page).toBe(2);

    act(() => {
      result.current.goPrev();
      result.current.goPrev();
    });
    expect(result.current.page).toBe(1);
    expect(result.current.hasPrev).toBe(false);

    // goPrev at page 1 is a no-op
    act(() => result.current.goPrev());
    expect(result.current.page).toBe(1);
  });

  it("handles the empty array: totalPages=1, no footer, empty pageItems", () => {
    const { result } = renderHook(() =>
      usePagination<Item>([], 15, (item) => item.id),
    );

    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageItems).toEqual([]);
    expect(result.current.showFooter).toBe(false);
    expect(result.current.hasPrev).toBe(false);
    expect(result.current.hasNext).toBe(false);
    expect(result.current.rangeLabel).toBe("0–0 of 0");
  });

  it("hides the footer when items fit in a single page", () => {
    const { result } = renderHook(() =>
      usePagination(items(8), 15, (item) => item.id),
    );

    expect(result.current.totalPages).toBe(1);
    expect(result.current.showFooter).toBe(false);
  });

  it("does NOT reset to page 1 when items reference changes but content signature is identical (SWR revalidation case)", () => {
    const initial = items(33);
    const { result, rerender } = renderHook(
      ({ data }: { data: Item[] }) =>
        usePagination(data, 15, (item) => item.id),
      { initialProps: { data: initial } },
    );

    act(() => result.current.goNext());
    act(() => result.current.goNext());
    expect(result.current.page).toBe(3);

    // SWR revalidates — same content, brand-new array reference
    const revalidated = items(33).map((item) => ({ ...item }));
    rerender({ data: revalidated });

    expect(result.current.page).toBe(3);
    expect(result.current.pageItems[0].id).toBe("a30");
  });

  it("DOES reset to page 1 when content signature changes (new data arrived)", () => {
    const initial = items(33);
    const { result, rerender } = renderHook(
      ({ data }: { data: Item[] }) =>
        usePagination(data, 15, (item) => item.id),
      { initialProps: { data: initial } },
    );

    act(() => result.current.goNext());
    expect(result.current.page).toBe(2);

    // Real new data: different first-item id (cron refresh brought fresh items to the top)
    const fresh = items(33, "b");
    rerender({ data: fresh });

    expect(result.current.page).toBe(1);
    expect(result.current.pageItems[0].id).toBe("b0");
  });

  it("resets to page 1 when items length changes even if first id matches", () => {
    const initial = items(33);
    const { result, rerender } = renderHook(
      ({ data }: { data: Item[] }) =>
        usePagination(data, 15, (item) => item.id),
      { initialProps: { data: initial } },
    );

    act(() => result.current.goNext());
    expect(result.current.page).toBe(2);

    // Same first-item id, different length — content has changed
    rerender({ data: items(20) });

    expect(result.current.page).toBe(1);
  });

  it("clamps page when items shrink such that current page no longer exists", () => {
    const initial = items(33);
    const { result, rerender } = renderHook(
      ({ data }: { data: Item[] }) =>
        usePagination(data, 15, (item) => item.id),
      { initialProps: { data: initial } },
    );

    act(() => result.current.goNext());
    act(() => result.current.goNext());
    expect(result.current.page).toBe(3);

    // Items shrink to a single page worth. Hook resets via content-change.
    rerender({ data: items(10) });
    expect(result.current.page).toBe(1);
    expect(result.current.pageItems).toHaveLength(10);
  });
});
