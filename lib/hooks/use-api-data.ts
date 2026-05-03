"use client";

import useSWR from "swr";
import type { ApiResponse } from "@/lib/types";

const fetcher = async <T>(url: string): Promise<ApiResponse<T>> => {
  const res = await fetch(url);
  if (!res.ok && res.status !== 503) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

export function useApiData<T>(endpoint: string, refreshInterval = 60_000) {
  const { data, error, isLoading } = useSWR<ApiResponse<T>>(
    endpoint,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
      dedupingInterval: 10_000,
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
