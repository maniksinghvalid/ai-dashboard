"use client";

import useSWR from "swr";
import type { ApiResponse } from "@/lib/types";

const fetcher = async <T>(url: string): Promise<ApiResponse<T>> => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`API error: ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  const json = await res.json();
  if (!json || typeof json !== "object" || !("data" in json)) {
    throw new Error("Invalid API response shape");
  }
  return json as ApiResponse<T>;
};

export function useApiData<T>(endpoint: string, refreshInterval = 60_000) {
  const { data, error, isLoading } = useSWR<ApiResponse<T>>(
    endpoint,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
      dedupingInterval: 10_000,
      errorRetryCount: 3,
    },
  );

  return {
    data: data?.data ?? null,
    cachedAt: data?.cachedAt ?? null,
    stale: data?.stale ?? false,
    isLoading,
    error: error ?? null,
  };
}
