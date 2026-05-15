import { useEffect, useRef, useState } from "react";

export interface PaginationResult<T> {
  pageItems: T[];
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  goPrev: () => void;
  goNext: () => void;
  rangeLabel: string;
  showFooter: boolean;
}

const defaultGetKey = <T,>(item: T): string =>
  typeof item === "object" && item !== null ? JSON.stringify(item) : String(item);

function signatureOf<T>(items: T[], getKey: (item: T) => string): string {
  if (items.length === 0) return "0:";
  return `${items.length}:${getKey(items[0])}`;
}

// Generic client-side pagination over an in-memory items array.
//
// Reset semantics: SWR polling delivers a new array reference every 60s even
// when the underlying content is unchanged. Resetting to page 1 on every items
// reference change would yank the user back to page 1 mid-browse. Instead we
// compare a content signature (length + first-item key) and only reset when
// it actually differs from the previous render. The default `getKey` falls
// back to JSON.stringify; widget call sites pass an `id`-extracting fn for
// stability and cost.
export function usePagination<T>(
  items: T[],
  pageSize: number,
  getKey?: (item: T) => string,
): PaginationResult<T> {
  const keyFn = getKey ?? (defaultGetKey as (item: T) => string);
  const [page, setPage] = useState(1);
  const signatureRef = useRef<string | null>(null);
  const signature = signatureOf(items, keyFn);

  useEffect(() => {
    if (signatureRef.current !== null && signatureRef.current !== signature) {
      setPage(1);
    }
    signatureRef.current = signature;
  }, [signature]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  // Items can shrink between renders before the effect fires; clamp at read
  // time so out-of-range page state never reaches consumers.
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * pageSize;
  const end = Math.min(start + pageSize, items.length);

  return {
    pageItems: items.slice(start, end),
    page: clampedPage,
    totalPages,
    hasPrev: clampedPage > 1,
    hasNext: clampedPage < totalPages,
    goPrev: () => setPage((p) => Math.max(1, p - 1)),
    goNext: () => setPage((p) => Math.min(totalPages, p + 1)),
    rangeLabel:
      items.length === 0 ? "0–0 of 0" : `${start + 1}–${end} of ${items.length}`,
    showFooter: totalPages > 1,
  };
}
