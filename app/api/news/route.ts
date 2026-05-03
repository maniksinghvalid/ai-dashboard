import { NextResponse } from "next/server";
import { cacheGet } from "@/lib/cache/helpers";
import { CACHE_KEYS, CACHE_MAX_AGE } from "@/lib/constants";
import type { NewsItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const cached = await cacheGet<NewsItem[]>(CACHE_KEYS.news, CACHE_MAX_AGE.default);

  if (!cached) {
    return NextResponse.json(
      { data: [], cachedAt: null, stale: false, error: "No data available" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    data: cached.data,
    cachedAt: cached.fetchedAt,
    stale: cached.stale,
  });
}
